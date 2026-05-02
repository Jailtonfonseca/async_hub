import { AppDataSource } from "../data-source";
import { Connection } from "../entities/Connection";
import { Product } from "../entities/Product";
import { WooCommerceAdapter } from "../adapters/WooCommerceAdapter";
import { MercadoLibreAdapter } from "../adapters/MercadoLibreAdapter";
import { AmazonAdapter } from "../adapters/AmazonAdapter";
import { ShopeeAdapter } from "../adapters/ShopeeAdapter";
import Redis from "redis";

interface SyncResult {
    marketplace: string;
    imported: number;
    updated: number;
    failed: number;
    errors: string[];
    startedAt: Date;
    completedAt: Date;
}

interface SyncStatus {
    isRunning: boolean;
    lastSync: Date | null;
    lastResult: SyncResult | null;
    nextSync: Date | null;
    intervalMinutes: number;
}

/**
 * Redis-backed distributed lock for sync operations
 */
class SyncLock {
    private redis: ReturnType<typeof Redis.createClient> | null = null;
    private lockKey = "async_hub:sync_lock";
    private lockTtlSeconds = 300; // 5 minutes max lock time

    constructor() {
        const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
        try {
            this.redis = Redis.createClient({ url: redisUrl });
            this.redis.on("error", (err) => {
                console.error("[SyncLock] Redis error:", err.message);
                this.redis = null;
            });
            this.redis.connect().catch((err) => {
                console.error("[SyncLock] Failed to connect to Redis:", err.message);
                this.redis = null;
            });
        } catch (error) {
            console.warn("[SyncLock] Redis not available, using in-memory lock");
            this.redis = null;
        }
    }

    async acquire(): Promise<boolean> {
        if (this.redis) {
            try {
                // Use SET with NX (only if not exists) and EX (expiry)
                const result = await this.redis.set(this.lockKey, "locked", {
                    NX: true,
                    EX: this.lockTtlSeconds,
                });
                return result === "OK";
            } catch (error) {
                console.error("[SyncLock] Redis acquire error:", error);
                return false;
            }
        }
        return false;
    }

    async release(): Promise<void> {
        if (this.redis) {
            try {
                await this.redis.del(this.lockKey);
            } catch (error) {
                console.error("[SyncLock] Redis release error:", error);
            }
        }
    }

    async isLocked(): Promise<boolean> {
        if (this.redis) {
            try {
                const result = await this.redis.exists(this.lockKey);
                return result === 1;
            } catch (error) {
                return false;
            }
        }
        return false;
    }
}

export class SyncScheduler {
    private intervalId: NodeJS.Timeout | null = null;
    private syncIntervalMs = 15 * 60 * 1000; // Default: 15 minutes
    private isRunning = false; // In-memory fallback
    private lastSync: Date | null = null;
    private lastResult: SyncResult | null = null;
    private syncHistory: SyncResult[] = [];
    private syncLock: SyncLock;

    constructor() {
        this.syncLock = new SyncLock();
        console.log("[SyncScheduler] Service created with Redis lock support");
    }

    /**
     * Start the automatic sync scheduler
     */
    async start(intervalMinutes: number = 15) {
        console.log(`[SyncScheduler] Starting with ${intervalMinutes} minute interval...`);
        this.syncIntervalMs = intervalMinutes * 60 * 1000;

        // Run first sync after 1 minute
        setTimeout(() => {
            this.runFullSync();
        }, 60 * 1000);

        // Then run periodically
        this.intervalId = setInterval(() => {
            this.runFullSync();
        }, this.syncIntervalMs);

        console.log(`[SyncScheduler] Next sync in 1 minute, then every ${intervalMinutes} minutes`);
    }

    /**
     * Stop the sync scheduler
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log("[SyncScheduler] Service stopped");
        }
    }

    /**
     * Run a full sync for all connected marketplaces
     */
    async runFullSync(): Promise<SyncResult[]> {
        // Try to acquire distributed lock
        const lockAcquired = await this.syncLock.acquire();
        
        if (!lockAcquired) {
            // Check if it's just the in-memory flag (for backwards compatibility)
            if (this.isRunning) {
                console.log("[SyncScheduler] Sync already in progress (in-memory), skipping...");
                return [];
            }
            console.log("[SyncScheduler] Could not acquire Redis lock, skipping...");
            return [];
        }

        this.isRunning = true;
        console.log("[SyncScheduler] Starting full sync...");

        const results: SyncResult[] = [];

        try {
            const connectionRepo = AppDataSource.getRepository(Connection);
            const connections = await connectionRepo.find();

            for (const conn of connections) {
                if (conn.isConnected) {
                    const result = await this.syncMarketplace(conn);
                    results.push(result);
                    this.syncHistory.push(result);
                }
            }

            this.lastSync = new Date();
            this.lastResult = results[results.length - 1] || null;

            // Keep only last 50 sync results
            if (this.syncHistory.length > 50) {
                this.syncHistory = this.syncHistory.slice(-50);
            }

            console.log("[SyncScheduler] Full sync completed");
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("[SyncScheduler] Error during sync:", errorMessage);
        } finally {
            this.isRunning = false;
            await this.syncLock.release();
        }

        return results;
    }

    /**
     * Sync a specific marketplace
     */
    private async syncMarketplace(connection: Connection): Promise<SyncResult> {
        const startedAt = new Date();
        const result: SyncResult = {
            marketplace: connection.marketplace,
            imported: 0,
            updated: 0,
            failed: 0,
            errors: [],
            startedAt,
            completedAt: new Date()
        };

        console.log(`[SyncScheduler] Syncing ${connection.marketplace}...`);

        try {
            if (connection.marketplace === "woocommerce") {
                await this.syncWooCommerce(connection, result);
            } else if (connection.marketplace === "mercadolibre") {
                await this.syncMercadoLibre(connection, result);
            } else if (connection.marketplace === "amazon") {
                await this.syncAmazon(connection, result);
            } else if (connection.marketplace === "shopee") {
                await this.syncShopee(connection, result);
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error(`[SyncScheduler] Error syncing ${connection.marketplace}:`, errorMessage);
            result.errors.push(errorMessage);
        }

        result.completedAt = new Date();
        console.log(`[SyncScheduler] ${connection.marketplace} sync: ${result.imported} imported, ${result.updated} updated, ${result.failed} failed`);

        return result;
    }

    /**
     * Sync products from WooCommerce with pagination support
     */
    private async syncWooCommerce(connection: Connection, result: SyncResult) {
        if (!connection.apiUrl || !connection.apiKey || !connection.apiSecret) {
            result.errors.push("Missing WooCommerce credentials");
            return;
        }

        const adapter = new WooCommerceAdapter({
            apiUrl: connection.apiUrl,
            apiKey: connection.apiKey,
            apiSecret: connection.apiSecret
        });

        const productRepo = AppDataSource.getRepository(Product);
        const batchSize = 50;
        let offset = 0;

        try {
            while (true) {
                const remoteProducts = await adapter.getProducts(batchSize, offset);
                
                if (remoteProducts.length === 0) {
                    break;
                }

                for (const remoteProduct of remoteProducts) {
                    try {
                        await this.syncSingleProduct(productRepo, remoteProduct, "woocommerce", result);
                    } catch (error: unknown) {
                        result.failed++;
                        const errorMessage = error instanceof Error ? error.message : "Unknown error";
                        result.errors.push(`Product ${remoteProduct.sku}: ${errorMessage}`);
                    }
                }

                offset += batchSize;
                
                if (offset > 10000) {
                    console.warn("[SyncScheduler] Reached maximum WooCommerce pagination limit");
                    break;
                }
            }

            console.log(`[SyncScheduler] WooCommerce sync completed: ${result.imported} imported, ${result.updated} updated`);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("[SyncScheduler] WooCommerce sync error:", errorMessage);
            result.errors.push(errorMessage);
        }
    }

    /**
     * Sync products from Mercado Libre with pagination support
     */
    private async syncMercadoLibre(connection: Connection, result: SyncResult) {
        if (!connection.accessToken) {
            result.errors.push("No access token available");
            return;
        }

        const adapter = new MercadoLibreAdapter({
            accessToken: connection.accessToken,
            userId: connection.userId || ""
        });

        const productRepo = AppDataSource.getRepository(Product);
        const batchSize = 50;
        let offset = 0;

        try {
            while (true) {
                const remoteProducts = await adapter.getProducts(batchSize, offset);
                
                if (remoteProducts.length === 0) {
                    break;
                }

                for (const remoteProduct of remoteProducts) {
                    try {
                        await this.syncSingleProduct(productRepo, remoteProduct, "mercadolibre", result);
                    } catch (error: unknown) {
                        result.failed++;
                        const errorMessage = error instanceof Error ? error.message : "Unknown error";
                        result.errors.push(`Product ${remoteProduct.sku}: ${errorMessage}`);
                    }
                }

                offset += batchSize;
                
                if (offset > 10000) {
                    console.warn("[SyncScheduler] Reached maximum Mercado Libre pagination limit");
                    break;
                }
            }

            console.log(`[SyncScheduler] Mercado Libre sync completed: ${result.imported} imported, ${result.updated} updated`);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("[SyncScheduler] Mercado Libre sync error:", errorMessage);
            result.errors.push(errorMessage);
        }
    }

    /**
     * Sync products from Amazon with pagination support
     */
    private async syncAmazon(connection: Connection, result: SyncResult) {
        if (!connection.accessToken || !connection.apiKey) {
            result.errors.push("Missing Amazon credentials");
            return;
        }

        const adapter = new AmazonAdapter({
            apiKey: connection.apiKey,
            apiSecret: connection.apiSecret,
            accessToken: connection.accessToken,
            userId: connection.userId || "",
            apiUrl: connection.apiUrl,
            refreshToken: connection.refreshToken,
        });

        const productRepo = AppDataSource.getRepository(Product);
        const batchSize = 50;
        let offset = 0;

        try {
            while (true) {
                const remoteProducts = await adapter.getProducts(batchSize, offset);
                
                if (remoteProducts.length === 0) {
                    break;
                }

                for (const remoteProduct of remoteProducts) {
                    try {
                        await this.syncSingleProduct(productRepo, remoteProduct, "amazon", result);
                    } catch (error: unknown) {
                        result.failed++;
                        const errorMessage = error instanceof Error ? error.message : "Unknown error";
                        result.errors.push(`Product ${remoteProduct.sku}: ${errorMessage}`);
                    }
                }

                offset += batchSize;
                
                if (offset > 10000) {
                    console.warn("[SyncScheduler] Reached maximum Amazon pagination limit");
                    break;
                }
            }

            console.log(`[SyncScheduler] Amazon sync completed: ${result.imported} imported, ${result.updated} updated`);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("[SyncScheduler] Amazon sync error:", errorMessage);
            result.errors.push(errorMessage);
        }
    }

    private async syncShopee(connection: Connection, result: SyncResult) {
        try {
            const productRepo = AppDataSource.getRepository(Product);
            const adapter = new ShopeeAdapter({
                apiKey: connection.apiKey || "",
                apiSecret: connection.apiSecret || "",
                accessToken: connection.accessToken || "",
                userId: connection.userId || "",
            });

            console.log("[SyncScheduler] Starting Shopee sync...");
            const products = await adapter.getProducts();
            console.log(`[SyncScheduler] Fetched ${products.length} products from Shopee`);

            for (const remoteProduct of products) {
                await this.syncSingleProduct(productRepo, remoteProduct, "shopee", result);
            }

            console.log(`[SyncScheduler] Shopee sync completed: ${result.imported} imported, ${result.updated} updated`);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("[SyncScheduler] Shopee sync error:", errorMessage);
            result.errors.push(errorMessage);
        }
    }

    /**
     * Sync a single product from any marketplace
     */
    private async syncSingleProduct(
        productRepo: any,
        remoteProduct: any,
        sourceMarketplace: string,
        result: SyncResult
    ) {
        const whereConditions: any[] = [{ sku: remoteProduct.sku }];
        
        if (sourceMarketplace === "woocommerce") {
            whereConditions.push({ woocommerceId: remoteProduct.externalId });
        } else if (sourceMarketplace === "mercadolibre") {
            whereConditions.push({ mercadoLibreId: remoteProduct.externalId });
        } else if (sourceMarketplace === "amazon") {
            whereConditions.push({ amazonId: remoteProduct.externalId });
        } else if (sourceMarketplace === "shopee") {
            whereConditions.push({ shopeeId: remoteProduct.externalId });
        }

        let localProduct = await productRepo.findOne({ where: whereConditions });

        if (localProduct) {
            let hasChanges = false;
            
            if (localProduct.title !== remoteProduct.title) {
                localProduct.title = remoteProduct.title;
                hasChanges = true;
            }
            if (localProduct.price !== remoteProduct.price) {
                localProduct.price = remoteProduct.price;
                hasChanges = true;
            }
            if (localProduct.salePrice !== remoteProduct.salePrice) {
                localProduct.salePrice = remoteProduct.salePrice;
                hasChanges = true;
            }
            if (localProduct.stock !== remoteProduct.stock) {
                localProduct.stock = remoteProduct.stock;
                hasChanges = true;
            }

            if (sourceMarketplace === "woocommerce") {
                localProduct.woocommerceId = remoteProduct.externalId;
            } else if (sourceMarketplace === "mercadolibre") {
                localProduct.mercadoLibreId = remoteProduct.externalId;
            } else if (sourceMarketplace === "amazon") {
                localProduct.amazonId = remoteProduct.externalId;
            } else if (sourceMarketplace === "shopee") {
                localProduct.shopeeId = remoteProduct.externalId;
            }

            if (hasChanges) {
                localProduct.lastSyncedAt = new Date();
                await productRepo.save(localProduct);
                result.updated++;
            }
        } else {
            const newProduct = productRepo.create({
                sku: remoteProduct.sku || `${sourceMarketplace}_${remoteProduct.externalId}`,
                title: remoteProduct.title,
                description: remoteProduct.description || "",
                price: remoteProduct.price,
                salePrice: remoteProduct.salePrice,
                stock: remoteProduct.stock,
                images: remoteProduct.images || [],
                woocommerceId: sourceMarketplace === "woocommerce" ? remoteProduct.externalId : null,
                mercadoLibreId: sourceMarketplace === "mercadolibre" ? remoteProduct.externalId : null,
                amazonId: sourceMarketplace === "amazon" ? remoteProduct.externalId : null,
                shopeeId: sourceMarketplace === "shopee" ? remoteProduct.externalId : null,
                sourceMarketplace,
                lastSyncedAt: new Date()
            });
            await productRepo.save(newProduct);
            result.imported++;
        }
    }

    /**
     * Manually trigger sync for a specific marketplace
     */
    async triggerSync(marketplace: string): Promise<SyncResult | null> {
        const connectionRepo = AppDataSource.getRepository(Connection);
        const connection = await connectionRepo.findOneBy({ marketplace });

        if (!connection || !connection.isConnected) {
            return null;
        }

        return this.syncMarketplace(connection);
    }

    /**
     * Get current sync status
     */
    getStatus(): SyncStatus {
        const nextSync = this.lastSync
            ? new Date(this.lastSync.getTime() + this.syncIntervalMs)
            : new Date(Date.now() + 60 * 1000);

        return {
            isRunning: this.isRunning,
            lastSync: this.lastSync,
            lastResult: this.lastResult,
            nextSync: this.intervalId ? nextSync : null,
            intervalMinutes: this.syncIntervalMs / 60000
        };
    }

    /**
     * Get sync history
     */
    getHistory(limit: number = 10): SyncResult[] {
        return this.syncHistory.slice(-limit).reverse();
    }

    /**
     * Update sync interval
     */
    setInterval(minutes: number) {
        console.log(`[SyncScheduler] Changing interval to ${minutes} minutes`);
        this.stop();
        this.start(minutes);
    }
}

// Export singleton instance
export const syncScheduler = new SyncScheduler();
