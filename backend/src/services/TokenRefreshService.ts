import { AppDataSource } from "../data-source";
import { Connection } from "../entities/Connection";
import { MercadoLibreAdapter } from "../adapters/MercadoLibreAdapter";

export class TokenRefreshService {
    private intervalId: NodeJS.Timeout | null = null;
    private checkIntervalMs = 30 * 60 * 1000; // Check every 30 minutes
    private refreshBeforeExpiryMs = 60 * 60 * 1000; // Refresh 1 hour before expiry

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
        this.intervalId = setInterval(() => {
            this.checkAndRefreshTokens();
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
        console.log("[TokenRefreshService] Checking tokens...");

        try {
            const connectionRepo = AppDataSource.getRepository(Connection);
            const connections = await connectionRepo.find();

            for (const conn of connections) {
                if (conn.marketplace === "mercadolibre" && conn.refreshToken) {
                    await this.checkMercadoLibreToken(conn, connectionRepo);
                }
            }
        } catch (error: any) {
            console.error("[TokenRefreshService] Error checking tokens:", error.message);
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
        } catch (error: any) {
            console.error("[TokenRefreshService] Failed to refresh token:", error.response?.data || error.message);

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
            }

            return { success: false, message: "Marketplace does not support token refresh" };
        } catch (error: any) {
            return { success: false, message: error.message };
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
