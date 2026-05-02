"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenRefreshService = exports.TokenRefreshService = void 0;
const data_source_1 = require("../data-source");
const Connection_1 = require("../entities/Connection");
const MercadoLibreAdapter_1 = require("../adapters/MercadoLibreAdapter");
const AmazonAdapter_1 = require("../adapters/AmazonAdapter");
class TokenRefreshService {
    constructor() {
        this.intervalId = null;
        this.checkIntervalMs = 30 * 60 * 1000; // Check every 30 minutes
        this.refreshBeforeExpiryMs = 60 * 60 * 1000; // Refresh 1 hour before expiry
        this.isRunning = false; // Prevent concurrent executions
        console.log("[TokenRefreshService] Service created");
    }
    /**
     * Start the automatic token refresh service
     */
    start() {
        console.log("[TokenRefreshService] Starting automatic token refresh...");
        // Run immediately on start
        this.checkAndRefreshTokens();
        // Then run periodically
        this.intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            yield this.checkAndRefreshTokens();
        }), this.checkIntervalMs);
        console.log(`[TokenRefreshService] Running every ${this.checkIntervalMs / 60000} minutes`);
    }
    /**
     * Stop the automatic token refresh service
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log("[TokenRefreshService] Service stopped");
        }
    }
    /**
     * Check all connections and refresh tokens if needed
     */
    checkAndRefreshTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            // Prevent concurrent executions
            if (this.isRunning) {
                console.log("[TokenRefreshService] Already running, skipping...");
                return;
            }
            this.isRunning = true;
            console.log("[TokenRefreshService] Checking tokens...");
            try {
                const connectionRepo = data_source_1.AppDataSource.getRepository(Connection_1.Connection);
                const connections = yield connectionRepo.find();
                for (const conn of connections) {
                    try {
                        if (conn.marketplace === "mercadolibre" && conn.refreshToken) {
                            yield this.checkMercadoLibreToken(conn, connectionRepo);
                        }
                        else if (conn.marketplace === "amazon" && conn.refreshToken) {
                            yield this.checkAmazonToken(conn, connectionRepo);
                        }
                    }
                    catch (error) {
                        const errMsg = error instanceof Error ? error.message : String(error);
                        console.error(`[TokenRefreshService] Error refreshing ${conn.marketplace} token:`, errMsg);
                        // Continue with next connection instead of failing all
                    }
                }
            }
            catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                console.error("[TokenRefreshService] Error checking tokens:", errMsg);
            }
            finally {
                this.isRunning = false;
            }
        });
    }
    /**
     * Check and refresh Mercado Libre token if needed
     */
    checkMercadoLibreToken(conn, repo) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const expiresAt = conn.tokenExpiresAt;
            if (!expiresAt) {
                console.log(`[TokenRefreshService] ML connection ${conn.id}: No expiry date set`);
                return;
            }
            const timeUntilExpiry = expiresAt.getTime() - now.getTime();
            const hoursUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60 * 60));
            console.log(`[TokenRefreshService] ML token expires in ${hoursUntilExpiry} hours`);
            // Refresh if token expires within the threshold
            if (timeUntilExpiry < this.refreshBeforeExpiryMs) {
                console.log("[TokenRefreshService] Token expiring soon, refreshing...");
                yield this.refreshMercadoLibreToken(conn, repo);
            }
            else if (timeUntilExpiry < 0) {
                console.log("[TokenRefreshService] Token already expired, marking disconnected");
                conn.isConnected = false;
                yield repo.save(conn);
            }
            else {
                console.log("[TokenRefreshService] Token is still valid");
            }
        });
    }
    /**
     * Refresh Mercado Libre token
     */
    refreshMercadoLibreToken(conn, repo) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!conn.refreshToken || !conn.apiKey || !conn.apiSecret) {
                    console.error("[TokenRefreshService] Missing credentials for refresh");
                    return;
                }
                const tokenData = yield MercadoLibreAdapter_1.MercadoLibreAdapter.refreshToken(conn.refreshToken, conn.apiKey, conn.apiSecret);
                // Update connection with new tokens
                conn.accessToken = tokenData.access_token;
                conn.refreshToken = tokenData.refresh_token;
                conn.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
                conn.isConnected = true;
                yield repo.save(conn);
                console.log("[TokenRefreshService] Token refreshed successfully!");
                console.log(`[TokenRefreshService] New expiry: ${conn.tokenExpiresAt}`);
            }
            catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                console.error("[TokenRefreshService] Failed to refresh token:", errMsg);
                // If refresh fails, mark as disconnected
                conn.isConnected = false;
                yield repo.save(conn);
            }
        });
    }
    /**
     * Check and refresh Amazon token if needed
     */
    checkAmazonToken(conn, repo) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const expiresAt = conn.tokenExpiresAt;
            // Amazon tokens typically last 1 hour, refresh 10 minutes before expiry
            const amazonRefreshThreshold = 10 * 60 * 1000;
            if (!expiresAt) {
                console.log(`[TokenRefreshService] Amazon connection ${conn.id}: No expiry date set`);
                return;
            }
            const timeUntilExpiry = expiresAt.getTime() - now.getTime();
            const minutesUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60));
            console.log(`[TokenRefreshService] Amazon token expires in ${minutesUntilExpiry} minutes`);
            // Refresh if token expires within threshold
            if (timeUntilExpiry < amazonRefreshThreshold) {
                console.log("[TokenRefreshService] Amazon token expiring soon, refreshing...");
                yield this.refreshAmazonToken(conn, repo);
            }
            else if (timeUntilExpiry < 0) {
                console.log("[TokenRefreshService] Amazon token already expired, marking disconnected");
                conn.isConnected = false;
                yield repo.save(conn);
            }
            else {
                console.log("[TokenRefreshService] Amazon token is still valid");
            }
        });
    }
    /**
     * Refresh Amazon token
     */
    refreshAmazonToken(conn, repo) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!conn.refreshToken || !conn.apiKey || !conn.apiSecret) {
                    console.error("[TokenRefreshService] Missing Amazon credentials for refresh");
                    return;
                }
                const tokenData = yield AmazonAdapter_1.AmazonAdapter.refreshToken(conn.refreshToken, conn.apiKey, conn.apiSecret);
                // Update connection with new tokens
                conn.accessToken = tokenData.access_token;
                conn.refreshToken = tokenData.refresh_token;
                // Amazon tokens expire in 3600 seconds (1 hour)
                conn.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
                conn.isConnected = true;
                yield repo.save(conn);
                console.log("[TokenRefreshService] Amazon token refreshed successfully!");
                console.log(`[TokenRefreshService] New expiry: ${conn.tokenExpiresAt}`);
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : "Unknown error";
                console.error("[TokenRefreshService] Failed to refresh Amazon token:", errorMsg);
                // If refresh fails, mark as disconnected
                conn.isConnected = false;
                yield repo.save(conn);
            }
        });
    }
    /**
     * Force refresh a specific connection's token
     */
    forceRefresh(marketplace) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const connectionRepo = data_source_1.AppDataSource.getRepository(Connection_1.Connection);
                const conn = yield connectionRepo.findOneBy({ marketplace });
                if (!conn) {
                    return { success: false, message: "Connection not found" };
                }
                if (marketplace === "mercadolibre") {
                    yield this.refreshMercadoLibreToken(conn, connectionRepo);
                    return { success: true, message: "Token refreshed successfully" };
                }
                else if (marketplace === "amazon") {
                    yield this.refreshAmazonToken(conn, connectionRepo);
                    return { success: true, message: "Amazon token refreshed successfully" };
                }
                return { success: false, message: `Marketplace ${marketplace} does not support token refresh` };
            }
            catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                return { success: false, message: errMsg };
            }
        });
    }
    /**
     * Get token status for a connection
     */
    getTokenStatus(marketplace) {
        return __awaiter(this, void 0, void 0, function* () {
            const connectionRepo = data_source_1.AppDataSource.getRepository(Connection_1.Connection);
            const conn = yield connectionRepo.findOneBy({ marketplace });
            if (!conn || !conn.accessToken) {
                return { hasToken: false, isValid: false, expiresAt: null, hoursUntilExpiry: null };
            }
            const now = new Date();
            const expiresAt = conn.tokenExpiresAt;
            if (!expiresAt) {
                return { hasToken: true, isValid: conn.isConnected, expiresAt: null, hoursUntilExpiry: null };
            }
            const timeUntilExpiry = expiresAt.getTime() - now.getTime();
            const hoursUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60 * 60));
            return {
                hasToken: true,
                isValid: timeUntilExpiry > 0 && conn.isConnected,
                expiresAt,
                hoursUntilExpiry: Math.max(0, hoursUntilExpiry)
            };
        });
    }
}
exports.TokenRefreshService = TokenRefreshService;
// Export singleton instance
exports.tokenRefreshService = new TokenRefreshService();
