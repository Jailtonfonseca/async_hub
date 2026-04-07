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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const data_source_1 = require("../data-source");
const Connection_1 = require("../entities/Connection");
const Product_1 = require("../entities/Product");
const MercadoLibreAdapter_1 = require("../adapters/MercadoLibreAdapter");
const WooCommerceAdapter_1 = require("../adapters/WooCommerceAdapter");
const router = (0, express_1.Router)();
const webhookLogs = [];
/**
 * Verify Mercado Libre webhook signature
 * ML sends X-ML-Signature header with HMAC-SHA256 signature
 */
function verifyMercadoLibreSignature(req, appSecret) {
    const signature = req.headers["x-ml-signature"];
    if (!signature)
        return false;
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto_1.default
        .createHmac("sha256", appSecret)
        .update(body)
        .digest("hex");
    return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
/**
 * Verify WooCommerce webhook signature
 * WC sends X-WC-Webhook-Signature header with HMAC-SHA256 signature
 */
function verifyWooCommerceSignature(req, secret) {
    const signature = req.headers["x-wc-webhook-signature"];
    if (!signature)
        return false;
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto_1.default
        .createHmac("sha256", secret)
        .update(body)
        .digest("base64");
    return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
/**
 * Mercado Libre Webhook Handler
 * Receives notifications about items, orders, questions, etc.
 *
 * ML sends: { resource: "/items/MLB123", user_id: 123, topic: "items", ... }
 */
router.post("/mercadolibre", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("[Webhook ML] Received:", JSON.stringify(req.body).substring(0, 500));
    const log = {
        timestamp: new Date(),
        source: "mercadolibre",
        topic: req.body.topic || "unknown",
        resourceId: req.body.resource || "",
        processed: false,
        signature: req.headers["x-ml-signature"]
    };
    try {
        const { topic, resource, user_id } = req.body;
        // Verify signature if app secret is configured
        const connectionRepo = data_source_1.AppDataSource.getRepository(Connection_1.Connection);
        const mlConnection = yield connectionRepo.findOneBy({ marketplace: "mercadolibre" });
        if (mlConnection === null || mlConnection === void 0 ? void 0 : mlConnection.apiSecret) {
            const isValid = verifyMercadoLibreSignature(req, mlConnection.apiSecret);
            if (!isValid) {
                console.warn("[Webhook ML] Invalid signature");
                log.error = "Invalid signature";
                webhookLogs.push(log);
                return res.status(401).json({ error: "Invalid signature" });
            }
        }
        // Always respond 200 quickly to acknowledge receipt
        res.status(200).json({ received: true });
        // Process asynchronously
        setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                if (topic === "items") {
                    yield processMLItemUpdate(resource, user_id);
                    log.processed = true;
                }
                else if (topic === "orders_v2") {
                    yield processMLOrderUpdate(resource, user_id);
                    log.processed = true;
                }
                else if (topic === "stock") {
                    yield processMLStockUpdate(resource, user_id);
                    log.processed = true;
                }
                else {
                    console.log(`[Webhook ML] Unhandled topic: ${topic}`);
                }
            }
            catch (error) {
                console.error("[Webhook ML] Processing error:", error.message);
                log.error = error.message;
            }
            finally {
                webhookLogs.push(log);
                if (webhookLogs.length > 100) {
                    webhookLogs.shift();
                }
            }
        }));
        return; // Return immediately after sending response
    }
    catch (error) {
        console.error("[Webhook ML] Error:", error.message);
        log.error = error.message;
        if (!res.headersSent) {
            res.status(200).json({ received: true, error: error.message });
        }
    }
    webhookLogs.push(log);
    if (webhookLogs.length > 100) {
        webhookLogs.shift();
    }
}));
/**
 * WooCommerce Webhook Handler
 * Receives notifications about product updates, order changes, etc.
 *
 * WC sends the full product/order object
 * WC also sends a ping request when creating/testing webhooks
 */
// Handle WC webhook verification (GET request)
router.get("/woocommerce", (_req, res) => {
    console.log("[Webhook WC] GET request received (verification ping)");
    res.status(200).json({ status: "ok", message: "WooCommerce webhook endpoint ready" });
});
// Handle WC webhook HEAD request (some WC versions use this)
router.head("/woocommerce", (_req, res) => {
    console.log("[Webhook WC] HEAD request received (verification ping)");
    res.status(200).end();
});
router.post("/woocommerce", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log("[Webhook WC] Received:", JSON.stringify(req.body).substring(0, 200));
    // Check if this is a ping/test request from WooCommerce
    const webhookId = req.headers["x-wc-webhook-id"];
    const topic = req.headers["x-wc-webhook-topic"] || "unknown";
    const deliveryId = req.headers["x-wc-webhook-delivery-id"];
    // If it's a ping request (empty body or webhook_id header but no real data)
    if (!req.body || Object.keys(req.body).length === 0 || topic === "ping") {
        console.log("[Webhook WC] Ping received, responding OK");
        return res.status(200).json({ status: "ok", message: "Ping received" });
    }
    const log = {
        timestamp: new Date(),
        source: "woocommerce",
        topic: topic,
        resourceId: ((_a = req.body.id) === null || _a === void 0 ? void 0 : _a.toString()) || "",
        processed: false,
        signature: req.headers["x-wc-webhook-signature"]
    };
    try {
        // Verify signature if secret is configured
        const connectionRepo = data_source_1.AppDataSource.getRepository(Connection_1.Connection);
        const wcConnection = yield connectionRepo.findOneBy({ marketplace: "woocommerce" });
        if (wcConnection === null || wcConnection === void 0 ? void 0 : wcConnection.apiSecret) {
            const isValid = verifyWooCommerceSignature(req, wcConnection.apiSecret);
            if (!isValid) {
                console.warn("[Webhook WC] Invalid signature");
                log.error = "Invalid signature";
                webhookLogs.push(log);
                return res.status(401).json({ error: "Invalid signature" });
            }
        }
        // Acknowledge receipt immediately
        res.status(200).json({ received: true });
        // Process asynchronously
        setImmediate(() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                if (topic === "product.updated" || topic === "product.created") {
                    yield processWCProductUpdate(req.body);
                    log.processed = true;
                }
                else if (topic === "order.created" || topic === "order.updated") {
                    yield processWCOrderUpdate(req.body);
                    log.processed = true;
                }
                else {
                    console.log(`[Webhook WC] Unhandled topic: ${topic}`);
                }
            }
            catch (error) {
                console.error("[Webhook WC] Processing error:", error.message);
                log.error = error.message;
            }
            finally {
                webhookLogs.push(log);
                if (webhookLogs.length > 100) {
                    webhookLogs.shift();
                }
            }
        }));
        return; // Return immediately after sending response
    }
    catch (error) {
        console.error("[Webhook WC] Error:", error.message);
        log.error = error.message;
        if (!res.headersSent) {
            res.status(200).json({ received: true, error: error.message });
        }
    }
    webhookLogs.push(log);
    if (webhookLogs.length > 100) {
        webhookLogs.shift();
    }
}));
/**
 * Get webhook logs for debugging
 */
router.get("/logs", (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    res.json(webhookLogs.slice(-limit).reverse());
});
/**
 * Test webhook endpoint (for verification)
 */
router.get("/test", (req, res) => {
    res.json({
        status: "ok",
        message: "Webhook endpoint is active",
        endpoints: {
            mercadolibre: "/api/webhooks/mercadolibre",
            woocommerce: "/api/webhooks/woocommerce"
        }
    });
});
// ============ Processing Functions ============
function processMLItemUpdate(resource, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        // resource format: /items/MLB12345
        const itemId = resource.replace("/items/", "");
        console.log(`[Webhook ML] Processing item update: ${itemId}`);
        const connectionRepo = data_source_1.AppDataSource.getRepository(Connection_1.Connection);
        const productRepo = data_source_1.AppDataSource.getRepository(Product_1.Product);
        const connection = yield connectionRepo.findOneBy({ marketplace: "mercadolibre" });
        if (!connection || !connection.accessToken) {
            console.log("[Webhook ML] No valid ML connection");
            return;
        }
        const adapter = new MercadoLibreAdapter_1.MercadoLibreAdapter({
            accessToken: connection.accessToken,
            userId: connection.userId || ""
        });
        const mlProduct = yield adapter.getProduct(itemId);
        if (!mlProduct) {
            console.log(`[Webhook ML] Product ${itemId} not found`);
            return;
        }
        // Find local product
        let localProduct = yield productRepo.findOne({
            where: [
                { mercadoLibreId: itemId },
                { sku: mlProduct.sku }
            ]
        });
        if (localProduct) {
            // Check if stock changed
            const stockChanged = localProduct.stock !== mlProduct.stock;
            // Update local product
            localProduct.title = mlProduct.title;
            localProduct.price = mlProduct.price;
            localProduct.stock = mlProduct.stock;
            localProduct.mercadoLibreId = itemId;
            localProduct.lastSyncedAt = new Date();
            yield productRepo.save(localProduct);
            console.log(`[Webhook ML] Updated product: ${localProduct.sku}`);
            // Sync stock to other products in the same group
            if (stockChanged && localProduct.groupId) {
                const groupProducts = yield productRepo.find({
                    where: { groupId: localProduct.groupId },
                });
                for (const gp of groupProducts) {
                    if (gp.id !== localProduct.id && gp.stock !== localProduct.stock) {
                        gp.stock = localProduct.stock;
                        gp.lastSyncedAt = new Date();
                        yield productRepo.save(gp);
                        console.log(`[Webhook ML] Synced stock to group member: ${gp.sku}`);
                    }
                }
            }
            // Optionally sync to WooCommerce
            yield syncToWooCommerce(localProduct);
        }
        else {
            // Create new product
            const newProduct = productRepo.create({
                sku: mlProduct.sku || itemId,
                title: mlProduct.title,
                description: mlProduct.description || "",
                price: mlProduct.price,
                stock: mlProduct.stock,
                images: mlProduct.images,
                mercadoLibreId: itemId,
                lastSyncedAt: new Date()
            });
            yield productRepo.save(newProduct);
            console.log(`[Webhook ML] Created product: ${newProduct.sku}`);
        }
    });
}
function processMLOrderUpdate(resource, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        // resource format: /orders/12345
        const orderId = resource.replace("/orders/", "");
        console.log(`[Webhook ML] Processing order: ${orderId}`);
        const connectionRepo = data_source_1.AppDataSource.getRepository(Connection_1.Connection);
        const productRepo = data_source_1.AppDataSource.getRepository(Product_1.Product);
        const connection = yield connectionRepo.findOneBy({ marketplace: "mercadolibre" });
        if (!connection || !connection.accessToken) {
            console.log("[Webhook ML] No valid ML connection");
            return;
        }
        const adapter = new MercadoLibreAdapter_1.MercadoLibreAdapter({
            accessToken: connection.accessToken,
            userId: connection.userId || ""
        });
        const order = yield adapter.getOrder(orderId);
        if (!order) {
            console.log(`[Webhook ML] Order ${orderId} not found`);
            return;
        }
        // Process each item in the order
        for (const item of order.order_items) {
            const itemId = item.item.id;
            const quantitySold = item.quantity;
            console.log(`[Webhook ML] Item sold: ${itemId}, Qty: ${quantitySold}`);
            // Find local product
            let localProduct = yield productRepo.findOne({
                where: [
                    { mercadoLibreId: itemId }
                ]
            });
            // Try by SKU if not found by ID (sometimes ML items are linked by SKU)
            if (!localProduct) {
                // In a real scenario we might need to fetch the item details to get the SKU
                // But let's assume we have it or start with ID search
            }
            if (localProduct) {
                console.log(`[Webhook ML] Found local product: ${localProduct.sku}. Stock before: ${localProduct.stock}`);
                // Decrement stock
                // Ensure we don't go below zero
                localProduct.stock = Math.max(0, localProduct.stock - quantitySold);
                localProduct.lastSyncedAt = new Date();
                yield productRepo.save(localProduct);
                console.log(`[Webhook ML] New stock: ${localProduct.stock}`);
                // === SYNC PROPAGATION ===
                // 1. Sync self to WooCommerce
                yield syncToWooCommerce(localProduct);
                // 2. Sync group members
                if (localProduct.groupId) {
                    const groupProducts = yield productRepo.find({
                        where: { groupId: localProduct.groupId },
                    });
                    for (const gp of groupProducts) {
                        if (gp.id !== localProduct.id && gp.stock !== localProduct.stock) {
                            gp.stock = localProduct.stock;
                            gp.lastSyncedAt = new Date();
                            yield productRepo.save(gp);
                            console.log(`[Webhook ML] Synced stock to group member: ${gp.sku}`);
                            // Critical: Push update to the group member's marketplace
                            yield syncToWooCommerce(gp);
                            yield syncToMercadoLibre(gp);
                        }
                    }
                }
            }
            else {
                console.log(`[Webhook ML] Product ${itemId} not found locally. Skipping stock update.`);
            }
        }
    });
}
function processMLStockUpdate(resource, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[Webhook ML] Stock update: ${resource}`);
        // Handle stock location updates
    });
}
function processWCProductUpdate(wcProduct) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        console.log(`[Webhook WC] Processing product update: ${wcProduct.id}`);
        const productRepo = data_source_1.AppDataSource.getRepository(Product_1.Product);
        // Find local product
        let localProduct = yield productRepo.findOne({
            where: [
                { woocommerceId: (_a = wcProduct.id) === null || _a === void 0 ? void 0 : _a.toString() },
                { sku: wcProduct.sku }
            ]
        });
        if (localProduct) {
            // Check if stock changed
            const newStock = wcProduct.stock_quantity || 0;
            const stockChanged = localProduct.stock !== newStock;
            // Update local product from WC data
            localProduct.title = wcProduct.name || localProduct.title;
            localProduct.price = parseFloat(wcProduct.regular_price) || localProduct.price;
            localProduct.salePrice = wcProduct.sale_price ? parseFloat(wcProduct.sale_price) : undefined;
            localProduct.stock = newStock;
            localProduct.woocommerceId = (_b = wcProduct.id) === null || _b === void 0 ? void 0 : _b.toString();
            localProduct.lastSyncedAt = new Date();
            yield productRepo.save(localProduct);
            console.log(`[Webhook WC] Updated product: ${localProduct.sku}`);
            // Sync stock to other products in the same group
            if (stockChanged && localProduct.groupId) {
                const groupProducts = yield productRepo.find({
                    where: { groupId: localProduct.groupId },
                });
                for (const gp of groupProducts) {
                    if (gp.id !== localProduct.id && gp.stock !== localProduct.stock) {
                        gp.stock = localProduct.stock;
                        gp.lastSyncedAt = new Date();
                        yield productRepo.save(gp);
                        console.log(`[Webhook WC] Synced stock to group member: ${gp.sku}`);
                    }
                }
            }
            // Sync to Mercado Libre
            yield syncToMercadoLibre(localProduct);
        }
        else {
            // Create new product
            const newProduct = productRepo.create({
                sku: wcProduct.sku || ((_c = wcProduct.id) === null || _c === void 0 ? void 0 : _c.toString()),
                title: wcProduct.name,
                description: wcProduct.description || "",
                price: parseFloat(wcProduct.regular_price) || 0,
                salePrice: wcProduct.sale_price ? parseFloat(wcProduct.sale_price) : undefined,
                stock: wcProduct.stock_quantity || 0,
                images: ((_d = wcProduct.images) === null || _d === void 0 ? void 0 : _d.map((img) => img.src)) || [],
                woocommerceId: (_e = wcProduct.id) === null || _e === void 0 ? void 0 : _e.toString(),
                lastSyncedAt: new Date()
            });
            yield productRepo.save(newProduct);
            console.log(`[Webhook WC] Created product: ${newProduct.sku}`);
        }
    });
}
function processWCOrderUpdate(wcOrder) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[Webhook WC] Order update: ${wcOrder.id} - Stock sync would happen here`);
        // Handle order-based stock updates
    });
}
// ============ Cross-Marketplace Sync ============
function syncToWooCommerce(product) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!product.woocommerceId) {
            console.log(`[Sync] Product ${product.sku} not linked to WC, skipping`);
            return;
        }
        try {
            const connectionRepo = data_source_1.AppDataSource.getRepository(Connection_1.Connection);
            const connection = yield connectionRepo.findOneBy({ marketplace: "woocommerce" });
            if (!connection || !connection.isConnected) {
                console.log("[Sync] WC not connected");
                return;
            }
            const adapter = new WooCommerceAdapter_1.WooCommerceAdapter({
                apiUrl: connection.apiUrl || "",
                apiKey: connection.apiKey || "",
                apiSecret: connection.apiSecret || ""
            });
            yield adapter.updateStock(product.woocommerceId, product.stock);
            yield adapter.updatePrice(product.woocommerceId, product.price, product.salePrice);
            console.log(`[Sync] Synced ${product.sku} to WooCommerce`);
        }
        catch (error) {
            console.error(`[Sync] Error syncing to WC: ${error.message}`);
        }
    });
}
function syncToMercadoLibre(product) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!product.mercadoLibreId) {
            console.log(`[Sync] Product ${product.sku} not linked to ML, skipping`);
            return;
        }
        try {
            const connectionRepo = data_source_1.AppDataSource.getRepository(Connection_1.Connection);
            const connection = yield connectionRepo.findOneBy({ marketplace: "mercadolibre" });
            if (!connection || !connection.accessToken) {
                console.log("[Sync] ML not connected");
                return;
            }
            const adapter = new MercadoLibreAdapter_1.MercadoLibreAdapter({
                accessToken: connection.accessToken,
                userId: connection.userId || ""
            });
            yield adapter.updateStock(product.mercadoLibreId, product.stock);
            yield adapter.updatePrice(product.mercadoLibreId, product.price, product.salePrice);
            console.log(`[Sync] Synced ${product.sku} to MercadoLibre`);
        }
        catch (error) {
            console.error(`[Sync] Error syncing to ML: ${error.message}`);
        }
    });
}
exports.default = router;
