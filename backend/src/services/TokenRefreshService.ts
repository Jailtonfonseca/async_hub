import { AppDataSource } from "../data-source";
import { Connection } from "../entities/Connection";
import { MercadoLibreAdapter } from "../adapters/MercadoLibreAdapter";
import { AmazonAdapter } from "../adapters/AmazonAdapter";

export class TokenRefreshService {
    private intervalId: NodeJS.Timeout | null = null;
    private checkIntervalMs = 30 * 60 * 1000; // Check every 30 minutes
    private refreshBeforeExpiryMs = 60 * 60 * 1000; // Refresh 1 hour before expiry
    private isRunning = false; // Prevent concurrent executions

    constructor() {
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
        this.intervalId = setInterval(async () => {
            await this.checkAndRefreshTokens();
        }, this.checkIntervalMs);

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
    async checkAndRefreshTokens() {
        // Prevent concurrent executions
        if (this.isRunning) {
            console.log("[TokenRefreshService] Already running, skipping...");
            return;
        }

        this.isRunning = true;
        console.log("[TokenRefreshService] Checking tokens...");

        try {
            const connectionRepo = AppDataSource.getRepository(Connection);
            const connections = await connectionRepo.find();

            for (const conn of connections) {
                try {
                    if (conn.marketplace === "mercadolibre" && conn.refreshToken) {
                        await this.checkMercadoLibreToken(conn, connectionRepo);
                    } else if (conn.marketplace === "amazon" && conn.refreshToken) {
                        await this.checkAmazonToken(conn, connectionRepo);
                    }
                } catch (error: unknown) {
                    const errMsg = error instanceof Error ? error.message : String(error);
                    console.error(`[TokenRefreshService] Error refreshing ${conn.marketplace} token:`, errMsg);
                    // Continue with next connection instead of failing all
                }
            }
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error("[TokenRefreshService] Error checking tokens:", errMsg);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Check and refresh Mercado Libre token if needed
     */
    private async checkMercadoLibreToken(conn: Connection, repo: any) {
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
            await this.refreshMercadoLibreToken(conn, repo);
        } else if (timeUntilExpiry < 0) {
            console.log("[TokenRefreshService] Token already expired, marking disconnected");
            conn.isConnected = false;
            await repo.save(conn);
        } else {
            console.log("[TokenRefreshService] Token is still valid");
        }
    }

    /**
     * Refresh Mercado Libre token
     */
    private async refreshMercadoLibreToken(conn: Connection, repo: any) {
        try {
            if (!conn.refreshToken || !conn.apiKey || !conn.apiSecret) {
                console.error("[TokenRefreshService] Missing credentials for refresh");
                return;
            }

            const tokenData = await MercadoLibreAdapter.refreshToken(
                conn.refreshToken,
                conn.apiKey,
                conn.apiSecret
            );

            // Update connection with new tokens
            conn.accessToken = tokenData.access_token;
            conn.refreshToken = tokenData.refresh_token;
            conn.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
            conn.isConnected = true;

            await repo.save(conn);

            console.log("[TokenRefreshService] Token refreshed successfully!");
            console.log(`[TokenRefreshService] New expiry: ${conn.tokenExpiresAt}`);
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error("[TokenRefreshService] Failed to refresh token:", errMsg);

            // If refresh fails, mark as disconnected
            conn.isConnected = false;
            await repo.save(conn);
        }
    }

    /**
     * Check and refresh Amazon token if needed
     */
    private async checkAmazonToken(conn: Connection, repo: any) {
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
            await this.refreshAmazonToken(conn, repo);
        } else if (timeUntilExpiry < 0) {
            console.log("[TokenRefreshService] Amazon token already expired, marking disconnected");
            conn.isConnected = false;
            await repo.save(conn);
        } else {
            console.log("[TokenRefreshService] Amazon token is still valid");
        }
    }

    /**
     * Refresh Amazon token
     */
    private async refreshAmazonToken(conn: Connection, repo: any) {
        try {
            if (!conn.refreshToken || !conn.apiKey || !conn.apiSecret) {
                console.error("[TokenRefreshService] Missing Amazon credentials for refresh");
                return;
            }

            const tokenData = await AmazonAdapter.refreshToken(
                conn.refreshToken,
                conn.apiKey,
                conn.apiSecret
            ) as { access_token: string; refresh_token: string; expires_in: number };

            // Update connection with new tokens
            conn.accessToken = tokenData.access_token;
            conn.refreshToken = tokenData.refresh_token;
            // Amazon tokens expire in 3600 seconds (1 hour)
            conn.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
            conn.isConnected = true;

            await repo.save(conn);

            console.log("[TokenRefreshService] Amazon token refreshed successfully!");
            console.log(`[TokenRefreshService] New expiry: ${conn.tokenExpiresAt}`);
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            console.error("[TokenRefreshService] Failed to refresh Amazon token:", errorMsg);

            // If refresh fails, mark as disconnected
            conn.isConnected = false;
            await repo.save(conn);
        }
    }

    /**
     * Force refresh a specific connection's token
     */
    async forceRefresh(marketplace: string): Promise<{ success: boolean; message: string }> {
        try {
            const connectionRepo = AppDataSource.getRepository(Connection);
            const conn = await connectionRepo.findOneBy({ marketplace });

            if (!conn) {
                return { success: false, message: "Connection not found" };
            }

            if (marketplace === "mercadolibre") {
                await this.refreshMercadoLibreToken(conn, connectionRepo);
                return { success: true, message: "Token refreshed successfully" };
            } else if (marketplace === "amazon") {
                await this.refreshAmazonToken(conn, connectionRepo);
                return { success: true, message: "Amazon token refreshed successfully" };
            }

            return { success: false, message: `Marketplace ${marketplace} does not support token refresh` };
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            return { success: false, message: errMsg };
        }
    }

    /**
     * Get token status for a connection
     */
    async getTokenStatus(marketplace: string): Promise<{
        hasToken: boolean;
        isValid: boolean;
        expiresAt: Date | null;
        hoursUntilExpiry: number | null;
    }> {
        const connectionRepo = AppDataSource.getRepository(Connection);
        const conn = await connectionRepo.findOneBy({ marketplace });

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
    }
}

// Export singleton instance
export const tokenRefreshService = new TokenRefreshService();
