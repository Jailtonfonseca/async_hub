import { AppDataSource } from "../data-source";
import { Connection } from "../entities/Connection";
import { Product } from "../entities/Product";
import { WooCommerceAdapter } from "../adapters/WooCommerceAdapter";
import { MercadoLibreAdapter } from "../adapters/MercadoLibreAdapter";

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

export class SyncScheduler {
    private intervalId: NodeJS.Timeout | null = null;
    private syncIntervalMs = 15 * 60 * 1000; // Default: 15 minutes
    private isRunning = false;
    private lastSync: Date | null = null;
    private lastResult: SyncResult | null = null;
    private syncHistory: SyncResult[] = [];

    constructor() {
        console.log("[SyncScheduler] Service created");
    }

    /**
     * Start the automatic sync scheduler
     */
    start(intervalMinutes: number = 15) {
        console.log(`[SyncScheduler] Starting with ${intervalMinutes} minute interval...`);
        this.syncIntervalMs = intervalMinutes * 60 * 1000;

        // Run first sync after 1 minute (give time for connections to be ready)
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
        if (this.isRunning) {
            console.log("[SyncScheduler] Sync already in progress, skipping...");
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
        } catch (error: any) {
            console.error("[SyncScheduler] Error during sync:", error.message);
        } finally {
            this.isRunning = false;
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
            }
        } catch (error: any) {
            console.error(`[SyncScheduler] Error syncing ${connection.marketplace}:`, error.message);
            result.errors.push(error.message);
        }

        result.completedAt = new Date();
        console.log(`[SyncScheduler] ${connection.marketplace} sync: ${result.imported} imported, ${result.updated} updated, ${result.failed} failed`);

        return result;
    }

    /**
     * Sync products from WooCommerce
     */
    private async syncWooCommerce(connection: Connection, result: SyncResult) {
        const adapter = new WooCommerceAdapter({
            apiUrl: connection.apiUrl || "",
            apiKey: connection.apiKey || "",
            apiSecret: connection.apiSecret || ""
        });

        const productRepo = AppDataSource.getRepository(Product);
        const remoteProducts = await adapter.getProducts(100, 0);

        for (const remoteProduct of remoteProducts) {
            try {
                // Find existing product by SKU or external ID
                let localProduct = await productRepo.findOne({
                    where: [
                        { sku: remoteProduct.sku },
                        { woocommerceId: remoteProduct.externalId }
                    ]
                });

                if (localProduct) {
                    // Update existing product
                    localProduct.title = remoteProduct.title;
                    localProduct.price = remoteProduct.price;
                    localProduct.salePrice = remoteProduct.salePrice;
                    localProduct.stock = remoteProduct.stock;
                    localProduct.woocommerceId = remoteProduct.externalId;
                    localProduct.lastSyncedAt = new Date();
                    await productRepo.save(localProduct);
                    result.updated++;
                } else {
                    // Create new product
                    const newProduct = productRepo.create({
                        sku: remoteProduct.sku,
                        title: remoteProduct.title,
                        description: remoteProduct.description,
                        price: remoteProduct.price,
                        salePrice: remoteProduct.salePrice,
                        stock: remoteProduct.stock,
                        images: remoteProduct.images,
                        woocommerceId: remoteProduct.externalId,
                        sourceMarketplace: "woocommerce",
                        lastSyncedAt: new Date()
                    });
                    await productRepo.save(newProduct);
                    result.imported++;
                }
            } catch (error: any) {
                result.failed++;
                result.errors.push(`Product ${remoteProduct.sku}: ${error.message}`);
            }
        }
    }

    /**
     * Sync products from Mercado Libre
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
        const remoteProducts = await adapter.getProducts(50, 0);

        for (const remoteProduct of remoteProducts) {
            try {
                // Find existing product by SKU or ML ID
                let localProduct = await productRepo.findOne({
                    where: [
                        { sku: remoteProduct.sku },
                        { mercadoLibreId: remoteProduct.externalId }
                    ]
                });

                if (localProduct) {
                    // Update existing product
                    localProduct.title = remoteProduct.title;
                    localProduct.price = remoteProduct.price;
                    localProduct.stock = remoteProduct.stock;
                    localProduct.mercadoLibreId = remoteProduct.externalId;
                    localProduct.lastSyncedAt = new Date();
                    await productRepo.save(localProduct);
                    result.updated++;
                } else {
                    // Create new product
                    const newProduct = productRepo.create({
                        sku: remoteProduct.sku || remoteProduct.externalId,
                        title: remoteProduct.title,
                        description: remoteProduct.description,
                        price: remoteProduct.price,
                        stock: remoteProduct.stock,
                        images: remoteProduct.images,
                        mercadoLibreId: remoteProduct.externalId,
                        sourceMarketplace: "mercadolibre",
                        lastSyncedAt: new Date()
                    });
                    await productRepo.save(newProduct);
                    result.imported++;
                }
            } catch (error: any) {
                result.failed++;
                result.errors.push(`Product ${remoteProduct.sku}: ${error.message}`);
            }
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
