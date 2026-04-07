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
exports.syncScheduler = exports.SyncScheduler = void 0;
const data_source_1 = require("../data-source");
const Connection_1 = require("../entities/Connection");
const Product_1 = require("../entities/Product");
const WooCommerceAdapter_1 = require("../adapters/WooCommerceAdapter");
const MercadoLibreAdapter_1 = require("../adapters/MercadoLibreAdapter");
class SyncScheduler {
    constructor() {
        this.intervalId = null;
        this.syncIntervalMs = 15 * 60 * 1000; // Default: 15 minutes
        this.isRunning = false;
        this.lastSync = null;
        this.lastResult = null;
        this.syncHistory = [];
        console.log("[SyncScheduler] Service created");
    }
    /**
     * Start the automatic sync scheduler
     */
    start(intervalMinutes = 15) {
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
    runFullSync() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRunning) {
                console.log("[SyncScheduler] Sync already in progress, skipping...");
                return [];
            }
            this.isRunning = true;
            console.log("[SyncScheduler] Starting full sync...");
            const results = [];
            try {
                const connectionRepo = data_source_1.AppDataSource.getRepository(Connection_1.Connection);
                const connections = yield connectionRepo.find();
                for (const conn of connections) {
                    if (conn.isConnected) {
                        const result = yield this.syncMarketplace(conn);
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
            }
            catch (error) {
                console.error("[SyncScheduler] Error during sync:", error.message);
            }
            finally {
                this.isRunning = false;
            }
            return results;
        });
    }
    /**
     * Sync a specific marketplace
     */
    syncMarketplace(connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const startedAt = new Date();
            const result = {
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
                    yield this.syncWooCommerce(connection, result);
                }
                else if (connection.marketplace === "mercadolibre") {
                    yield this.syncMercadoLibre(connection, result);
                }
            }
            catch (error) {
                console.error(`[SyncScheduler] Error syncing ${connection.marketplace}:`, error.message);
                result.errors.push(error.message);
            }
            result.completedAt = new Date();
            console.log(`[SyncScheduler] ${connection.marketplace} sync: ${result.imported} imported, ${result.updated} updated, ${result.failed} failed`);
            return result;
        });
    }
    /**
     * Sync products from WooCommerce with pagination support
     */
    syncWooCommerce(connection, result) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!connection.apiUrl || !connection.apiKey || !connection.apiSecret) {
                result.errors.push("Missing WooCommerce credentials");
                return;
            }
            const adapter = new WooCommerceAdapter_1.WooCommerceAdapter({
                apiUrl: connection.apiUrl,
                apiKey: connection.apiKey,
                apiSecret: connection.apiSecret
            });
            const productRepo = data_source_1.AppDataSource.getRepository(Product_1.Product);
            const batchSize = 50;
            let offset = 0;
            let totalImported = 0;
            let totalUpdated = 0;
            try {
                while (true) {
                    const remoteProducts = yield adapter.getProducts(batchSize, offset);
                    if (remoteProducts.length === 0) {
                        break; // No more products
                    }
                    for (const remoteProduct of remoteProducts) {
                        try {
                            // Use transaction for each product to ensure data consistency
                            yield this.syncSingleProduct(productRepo, remoteProduct, "woocommerce", result);
                        }
                        catch (error) {
                            result.failed++;
                            result.errors.push(`Product ${remoteProduct.sku}: ${error.message}`);
                        }
                    }
                    offset += batchSize;
                    // Safety limit to prevent infinite loops
                    if (offset > 10000) {
                        console.warn("[SyncScheduler] Reached maximum WooCommerce pagination limit");
                        break;
                    }
                }
                console.log(`[SyncScheduler] WooCommerce sync completed: ${result.imported} imported, ${result.updated} updated`);
            }
            catch (error) {
                console.error("[SyncScheduler] WooCommerce sync error:", error.message);
                result.errors.push(error.message);
            }
        });
    }
    /**
     * Sync a single product from any marketplace
     */
    syncSingleProduct(productRepo, remoteProduct, sourceMarketplace, result) {
        return __awaiter(this, void 0, void 0, function* () {
            // Find existing product by SKU or external ID
            const whereConditions = [{ sku: remoteProduct.sku }];
            if (sourceMarketplace === "woocommerce") {
                whereConditions.push({ woocommerceId: remoteProduct.externalId });
            }
            else if (sourceMarketplace === "mercadolibre") {
                whereConditions.push({ mercadoLibreId: remoteProduct.externalId });
            }
            else if (sourceMarketplace === "amazon") {
                whereConditions.push({ amazonId: remoteProduct.externalId });
            }
            let localProduct = yield productRepo.findOne({ where: whereConditions });
            if (localProduct) {
                // Update existing product - only update changed fields
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
                // Update marketplace-specific ID
                if (sourceMarketplace === "woocommerce") {
                    localProduct.woocommerceId = remoteProduct.externalId;
                }
                else if (sourceMarketplace === "mercadolibre") {
                    localProduct.mercadoLibreId = remoteProduct.externalId;
                }
                else if (sourceMarketplace === "amazon") {
                    localProduct.amazonId = remoteProduct.externalId;
                }
                if (hasChanges) {
                    localProduct.lastSyncedAt = new Date();
                    yield productRepo.save(localProduct);
                    result.updated++;
                }
            }
            else {
                // Create new product
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
                    sourceMarketplace,
                    lastSyncedAt: new Date()
                });
                yield productRepo.save(newProduct);
                result.imported++;
            }
        });
    }
    /**
     * Sync products from Mercado Libre with pagination support
     */
    syncMercadoLibre(connection, result) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!connection.accessToken) {
                result.errors.push("No access token available");
                return;
            }
            const adapter = new MercadoLibreAdapter_1.MercadoLibreAdapter({
                accessToken: connection.accessToken,
                userId: connection.userId || ""
            });
            const productRepo = data_source_1.AppDataSource.getRepository(Product_1.Product);
            const batchSize = 50;
            let offset = 0;
            try {
                while (true) {
                    const remoteProducts = yield adapter.getProducts(batchSize, offset);
                    if (remoteProducts.length === 0) {
                        break; // No more products
                    }
                    for (const remoteProduct of remoteProducts) {
                        try {
                            yield this.syncSingleProduct(productRepo, remoteProduct, "mercadolibre", result);
                        }
                        catch (error) {
                            result.failed++;
                            result.errors.push(`Product ${remoteProduct.sku}: ${error.message}`);
                        }
                    }
                    offset += batchSize;
                    // Safety limit to prevent infinite loops
                    if (offset > 10000) {
                        console.warn("[SyncScheduler] Reached maximum Mercado Libre pagination limit");
                        break;
                    }
                }
                console.log(`[SyncScheduler] Mercado Libre sync completed: ${result.imported} imported, ${result.updated} updated`);
            }
            catch (error) {
                console.error("[SyncScheduler] Mercado Libre sync error:", error.message);
                result.errors.push(error.message);
            }
        });
    }
    /**
     * Manually trigger sync for a specific marketplace
     */
    triggerSync(marketplace) {
        return __awaiter(this, void 0, void 0, function* () {
            const connectionRepo = data_source_1.AppDataSource.getRepository(Connection_1.Connection);
            const connection = yield connectionRepo.findOneBy({ marketplace });
            if (!connection || !connection.isConnected) {
                return null;
            }
            return this.syncMarketplace(connection);
        });
    }
    /**
     * Get current sync status
     */
    getStatus() {
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
    getHistory(limit = 10) {
        return this.syncHistory.slice(-limit).reverse();
    }
    /**
     * Update sync interval
     */
    setInterval(minutes) {
        console.log(`[SyncScheduler] Changing interval to ${minutes} minutes`);
        this.stop();
        this.start(minutes);
    }
}
exports.SyncScheduler = SyncScheduler;
// Export singleton instance
exports.syncScheduler = new SyncScheduler();
