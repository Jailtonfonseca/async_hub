import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Connection } from "../entities/Connection";
import { Product } from "../entities/Product";
import { MercadoLibreAdapter } from "../adapters/MercadoLibreAdapter";
import { WooCommerceAdapter } from "../adapters/WooCommerceAdapter";

const router = Router();

// Store webhook logs for debugging
interface WebhookLog {
    timestamp: Date;
    source: "mercadolibre" | "woocommerce";
    topic: string;
    resourceId: string;
    processed: boolean;
    error?: string;
}

const webhookLogs: WebhookLog[] = [];

/**
 * Mercado Libre Webhook Handler
 * Receives notifications about items, orders, questions, etc.
 * 
 * ML sends: { resource: "/items/MLB123", user_id: 123, topic: "items", ... }
 */
router.post("/mercadolibre", async (req: any, res: any) => {
    console.log("[Webhook ML] Received:", JSON.stringify(req.body));

    const log: WebhookLog = {
        timestamp: new Date(),
        source: "mercadolibre",
        topic: req.body.topic || "unknown",
        resourceId: req.body.resource || "",
        processed: false
    };

    try {
        const { topic, resource, user_id } = req.body;

        // Always respond 200 quickly to acknowledge receipt
        res.status(200).json({ received: true });

        // Process in background
        if (topic === "items") {
            await processMLItemUpdate(resource, user_id);
            log.processed = true;
        } else if (topic === "orders_v2") {
            await processMLOrderUpdate(resource, user_id);
            log.processed = true;
        } else if (topic === "stock") {
            await processMLStockUpdate(resource, user_id);
            log.processed = true;
        } else {
            console.log(`[Webhook ML] Unhandled topic: ${topic}`);
        }
    } catch (error: any) {
        console.error("[Webhook ML] Error:", error.message);
        log.error = error.message;
        // Still return 200 to prevent ML from retrying
        if (!res.headersSent) {
            res.status(200).json({ received: true, error: error.message });
        }
    }

    webhookLogs.push(log);
    if (webhookLogs.length > 100) {
        webhookLogs.shift(); // Keep only last 100 logs
    }
});

/**
 * WooCommerce Webhook Handler
 * Receives notifications about product updates, order changes, etc.
 * 
 * WC sends the full product/order object
 * WC also sends a ping request when creating/testing webhooks
 */

// Handle WC webhook verification (GET request)
router.get("/woocommerce", (req: any, res: any) => {
    console.log("[Webhook WC] GET request received (verification ping)");
    res.status(200).json({ status: "ok", message: "WooCommerce webhook endpoint ready" });
});

// Handle WC webhook HEAD request (some WC versions use this)
router.head("/woocommerce", (req: any, res: any) => {
    console.log("[Webhook WC] HEAD request received (verification ping)");
    res.status(200).end();
});

router.post("/woocommerce", async (req: any, res: any) => {
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

    const log: WebhookLog = {
        timestamp: new Date(),
        source: "woocommerce",
        topic: topic as string,
        resourceId: req.body.id?.toString() || "",
        processed: false
    };

    try {
        // Acknowledge receipt immediately
        res.status(200).json({ received: true });

        // Process based on topic
        if (topic === "product.updated" || topic === "product.created") {
            await processWCProductUpdate(req.body);
            log.processed = true;
        } else if (topic === "order.created" || topic === "order.updated") {
            await processWCOrderUpdate(req.body);
            log.processed = true;
        } else {
            console.log(`[Webhook WC] Unhandled topic: ${topic}`);
        }
    } catch (error: any) {
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
});

/**
 * Get webhook logs for debugging
 */
router.get("/logs", (req: any, res: any) => {
    const limit = parseInt(req.query.limit) || 20;
    res.json(webhookLogs.slice(-limit).reverse());
});

/**
 * Test webhook endpoint (for verification)
 */
router.get("/test", (req: any, res: any) => {
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

async function processMLItemUpdate(resource: string, userId: number) {
    // resource format: /items/MLB12345
    const itemId = resource.replace("/items/", "");
    console.log(`[Webhook ML] Processing item update: ${itemId}`);

    const connectionRepo = AppDataSource.getRepository(Connection);
    const productRepo = AppDataSource.getRepository(Product);

    const connection = await connectionRepo.findOneBy({ marketplace: "mercadolibre" });
    if (!connection || !connection.accessToken) {
        console.log("[Webhook ML] No valid ML connection");
        return;
    }

    const adapter = new MercadoLibreAdapter({
        accessToken: connection.accessToken,
        userId: connection.userId || ""
    });

    const mlProduct = await adapter.getProduct(itemId);
    if (!mlProduct) {
        console.log(`[Webhook ML] Product ${itemId} not found`);
        return;
    }

    // Find local product
    let localProduct = await productRepo.findOne({
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
        await productRepo.save(localProduct);
        console.log(`[Webhook ML] Updated product: ${localProduct.sku}`);

        // Sync stock to other products in the same group
        if (stockChanged && localProduct.groupId) {
            const groupProducts = await productRepo.find({
                where: { groupId: localProduct.groupId },
            });
            for (const gp of groupProducts) {
                if (gp.id !== localProduct.id && gp.stock !== localProduct.stock) {
                    gp.stock = localProduct.stock;
                    gp.lastSyncedAt = new Date();
                    await productRepo.save(gp);
                    console.log(`[Webhook ML] Synced stock to group member: ${gp.sku}`);
                }
            }
        }

        // Optionally sync to WooCommerce
        await syncToWooCommerce(localProduct);
    } else {
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
        await productRepo.save(newProduct);
        console.log(`[Webhook ML] Created product: ${newProduct.sku}`);
    }
}

async function processMLOrderUpdate(resource: string, userId: number) {
    // resource format: /orders/12345
    const orderId = resource.replace("/orders/", "");
    console.log(`[Webhook ML] Processing order: ${orderId}`);

    const connectionRepo = AppDataSource.getRepository(Connection);
    const productRepo = AppDataSource.getRepository(Product);

    const connection = await connectionRepo.findOneBy({ marketplace: "mercadolibre" });
    if (!connection || !connection.accessToken) {
        console.log("[Webhook ML] No valid ML connection");
        return;
    }

    const adapter = new MercadoLibreAdapter({
        accessToken: connection.accessToken,
        userId: connection.userId || ""
    });

    const order = await adapter.getOrder(orderId);
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
        let localProduct = await productRepo.findOne({
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
            await productRepo.save(localProduct);

            console.log(`[Webhook ML] New stock: ${localProduct.stock}`);

            // === SYNC PROPAGATION ===

            // 1. Sync self to WooCommerce
            await syncToWooCommerce(localProduct);

            // 2. Sync group members
            if (localProduct.groupId) {
                const groupProducts = await productRepo.find({
                    where: { groupId: localProduct.groupId },
                });

                for (const gp of groupProducts) {
                    if (gp.id !== localProduct.id && gp.stock !== localProduct.stock) {
                        gp.stock = localProduct.stock;
                        gp.lastSyncedAt = new Date();
                        await productRepo.save(gp);
                        console.log(`[Webhook ML] Synced stock to group member: ${gp.sku}`);

                        // Critical: Push update to the group member's marketplace
                        await syncToWooCommerce(gp);
                        await syncToMercadoLibre(gp);
                    }
                }
            }
        } else {
            console.log(`[Webhook ML] Product ${itemId} not found locally. Skipping stock update.`);
        }
    }
}

async function processMLStockUpdate(resource: string, userId: number) {
    console.log(`[Webhook ML] Stock update: ${resource}`);
    // Handle stock location updates
}

async function processWCProductUpdate(wcProduct: any) {
    console.log(`[Webhook WC] Processing product update: ${wcProduct.id}`);

    const productRepo = AppDataSource.getRepository(Product);

    // Find local product
    let localProduct = await productRepo.findOne({
        where: [
            { woocommerceId: wcProduct.id?.toString() },
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
        localProduct.woocommerceId = wcProduct.id?.toString();
        localProduct.lastSyncedAt = new Date();
        await productRepo.save(localProduct);
        console.log(`[Webhook WC] Updated product: ${localProduct.sku}`);

        // Sync stock to other products in the same group
        if (stockChanged && localProduct.groupId) {
            const groupProducts = await productRepo.find({
                where: { groupId: localProduct.groupId },
            });
            for (const gp of groupProducts) {
                if (gp.id !== localProduct.id && gp.stock !== localProduct.stock) {
                    gp.stock = localProduct.stock;
                    gp.lastSyncedAt = new Date();
                    await productRepo.save(gp);
                    console.log(`[Webhook WC] Synced stock to group member: ${gp.sku}`);
                }
            }
        }

        // Sync to Mercado Libre
        await syncToMercadoLibre(localProduct);
    } else {
        // Create new product
        const newProduct = productRepo.create({
            sku: wcProduct.sku || wcProduct.id?.toString(),
            title: wcProduct.name,
            description: wcProduct.description || "",
            price: parseFloat(wcProduct.regular_price) || 0,
            salePrice: wcProduct.sale_price ? parseFloat(wcProduct.sale_price) : undefined,
            stock: wcProduct.stock_quantity || 0,
            images: wcProduct.images?.map((img: any) => img.src) || [],
            woocommerceId: wcProduct.id?.toString(),
            lastSyncedAt: new Date()
        });
        await productRepo.save(newProduct);
        console.log(`[Webhook WC] Created product: ${newProduct.sku}`);
    }
}

async function processWCOrderUpdate(wcOrder: any) {
    console.log(`[Webhook WC] Order update: ${wcOrder.id} - Stock sync would happen here`);
    // Handle order-based stock updates
}

// ============ Cross-Marketplace Sync ============

async function syncToWooCommerce(product: Product) {
    if (!product.woocommerceId) {
        console.log(`[Sync] Product ${product.sku} not linked to WC, skipping`);
        return;
    }

    try {
        const connectionRepo = AppDataSource.getRepository(Connection);
        const connection = await connectionRepo.findOneBy({ marketplace: "woocommerce" });

        if (!connection || !connection.isConnected) {
            console.log("[Sync] WC not connected");
            return;
        }

        const adapter = new WooCommerceAdapter({
            apiUrl: connection.apiUrl || "",
            apiKey: connection.apiKey || "",
            apiSecret: connection.apiSecret || ""
        });

        await adapter.updateStock(product.woocommerceId, product.stock);
        await adapter.updatePrice(product.woocommerceId, product.price, product.salePrice);
        console.log(`[Sync] Synced ${product.sku} to WooCommerce`);
    } catch (error: any) {
        console.error(`[Sync] Error syncing to WC: ${error.message}`);
    }
}

async function syncToMercadoLibre(product: Product) {
    if (!product.mercadoLibreId) {
        console.log(`[Sync] Product ${product.sku} not linked to ML, skipping`);
        return;
    }

    try {
        const connectionRepo = AppDataSource.getRepository(Connection);
        const connection = await connectionRepo.findOneBy({ marketplace: "mercadolibre" });

        if (!connection || !connection.accessToken) {
            console.log("[Sync] ML not connected");
            return;
        }

        const adapter = new MercadoLibreAdapter({
            accessToken: connection.accessToken,
            userId: connection.userId || ""
        });

        await adapter.updateStock(product.mercadoLibreId, product.stock);
        await adapter.updatePrice(product.mercadoLibreId, product.price, product.salePrice);
        console.log(`[Sync] Synced ${product.sku} to MercadoLibre`);
    } catch (error: any) {
        console.error(`[Sync] Error syncing to ML: ${error.message}`);
    }
}

export default router;
