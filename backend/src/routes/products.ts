import { Router, Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Product } from "../entities/Product";
import { Connection } from "../entities/Connection";
import { WooCommerceAdapter } from "../adapters/WooCommerceAdapter";
import { MercadoLibreAdapter } from "../adapters/MercadoLibreAdapter";

const router = Router();
const productRepo = () => AppDataSource.getRepository(Product);
const connectionRepo = () => AppDataSource.getRepository(Connection);

// Get all local products
router.get("/", async (req: Request, res: Response) => {
    try {
        const products = await productRepo().find({
            order: { updatedAt: "DESC" },
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch products" });
    }
});

// Get single product
router.get("/:id", async (req: Request, res: Response) => {
    try {
        const product = await productRepo().findOneBy({ id: parseInt(req.params.id) });
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch product" });
    }
});

// Create product
router.post("/", async (req: Request, res: Response) => {
    try {
        const product = productRepo().create(req.body);
        await productRepo().save(product);
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ error: "Failed to create product" });
    }
});

// Update product (with auto-sync to marketplaces)
router.put("/:id", async (req: Request, res: Response) => {
    try {
        const product = await productRepo().findOneBy({ id: parseInt(req.params.id) });
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        // Track what changed
        const priceChanged = req.body.price !== undefined && Number(req.body.price) !== Number(product.price);
        const salePriceChanged = req.body.salePrice !== undefined && Number(req.body.salePrice) !== Number(product.salePrice);
        const stockChanged = req.body.stock !== undefined && Number(req.body.stock) !== Number(product.stock);

        // Update local product
        Object.assign(product, req.body);
        product.lastSyncedAt = new Date();
        await productRepo().save(product);

        // Auto-sync to marketplaces if price or stock changed
        const syncResults: any = { local: true, woocommerce: null, mercadolibre: null };

        if (priceChanged || salePriceChanged || stockChanged) {
            console.log(`[ProductSync] Changes detected - price: ${priceChanged}, salePrice: ${salePriceChanged}, stock: ${stockChanged}`);

            // Sync to WooCommerce
            if (product.woocommerceId) {
                try {
                    const wcConnection = await connectionRepo().findOneBy({ marketplace: "woocommerce" });
                    if (wcConnection && wcConnection.isConnected) {
                        const wcAdapter = new WooCommerceAdapter({
                            apiUrl: wcConnection.apiUrl || "",
                            apiKey: wcConnection.apiKey || "",
                            apiSecret: wcConnection.apiSecret || "",
                        });

                        if (stockChanged) {
                            await wcAdapter.updateStock(product.woocommerceId, product.stock);
                        }
                        if (priceChanged || salePriceChanged) {
                            await wcAdapter.updatePrice(product.woocommerceId, Number(product.price), product.salePrice ? Number(product.salePrice) : undefined);
                        }

                        syncResults.woocommerce = "synced";
                        console.log(`[ProductSync] Synced to WooCommerce: ${product.sku}`);
                    }
                } catch (e: any) {
                    syncResults.woocommerce = `error: ${e.message}`;
                    console.error(`[ProductSync] WC sync error: ${e.message}`);
                }
            }

            // Sync to Mercado Libre
            if (product.mercadoLibreId) {
                try {
                    const mlConnection = await connectionRepo().findOneBy({ marketplace: "mercadolibre" });
                    if (mlConnection && mlConnection.accessToken) {
                        const mlAdapter = new MercadoLibreAdapter({
                            accessToken: mlConnection.accessToken,
                            userId: mlConnection.userId || "",
                        });

                        if (stockChanged) {
                            await mlAdapter.updateStock(product.mercadoLibreId, product.stock);
                        }
                        if (priceChanged) {
                            await mlAdapter.updatePrice(product.mercadoLibreId, Number(product.price));
                        }

                        syncResults.mercadolibre = "synced";
                        console.log(`[ProductSync] Synced to MercadoLibre: ${product.sku}`);
                    }
                } catch (e: any) {
                    syncResults.mercadolibre = `error: ${e.message}`;
                    console.error(`[ProductSync] ML sync error: ${e.message}`);
                }
            }
        }

        res.json({ ...product, syncResults });
    } catch (error: any) {
        console.error("[ProductSync] Update error:", error);
        res.status(500).json({ error: "Failed to update product" });
    }
});

// Delete product
router.delete("/:id", async (req: Request, res: Response) => {
    try {
        await productRepo().delete({ id: parseInt(req.params.id) });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete product" });
    }
});

// Import products from a marketplace
router.post("/import/:marketplace", async (req: Request, res: Response) => {
    try {
        const { marketplace } = req.params;
        const connection = await connectionRepo().findOneBy({ marketplace });

        if (!connection || !connection.isConnected) {
            return res.status(400).json({ error: `${marketplace} not connected` });
        }

        let adapter;
        if (marketplace === "woocommerce") {
            adapter = new WooCommerceAdapter({
                apiUrl: connection.apiUrl,
                apiKey: connection.apiKey,
                apiSecret: connection.apiSecret,
            });
        } else if (marketplace === "mercadolibre") {
            adapter = new MercadoLibreAdapter({
                accessToken: connection.accessToken,
                userId: connection.userId,
            });
        } else {
            return res.status(400).json({ error: "Unknown marketplace" });
        }

        const externalProducts = await adapter.getProducts();
        let imported = 0;
        let updated = 0;
        let skipped = 0;

        for (const extProd of externalProducts) {
            let product = null;

            // First, try to find by external ID (prevents duplicates)
            if (marketplace === "mercadolibre" && extProd.externalId) {
                product = await productRepo().findOneBy({ mercadoLibreId: extProd.externalId });
            } else if (marketplace === "woocommerce" && extProd.externalId) {
                product = await productRepo().findOneBy({ woocommerceId: extProd.externalId });
            }

            // If not found by external ID, try by SKU
            if (!product && extProd.sku) {
                product = await productRepo().findOneBy({ sku: extProd.sku });
            }

            if (product) {
                // Update existing - only if it's from the same marketplace
                const isSameSource =
                    (marketplace === "mercadolibre" && product.mercadoLibreId === extProd.externalId) ||
                    (marketplace === "woocommerce" && product.woocommerceId === extProd.externalId) ||
                    (!product.mercadoLibreId && !product.woocommerceId);

                if (isSameSource || !product.mercadoLibreId) {
                    product.title = extProd.title;
                    product.description = extProd.description;
                    product.price = extProd.price;
                    product.salePrice = extProd.salePrice;
                    product.stock = extProd.stock;
                    product.images = extProd.images;
                    product.lastSyncedAt = new Date();

                    if (marketplace === "woocommerce") {
                        product.woocommerceId = extProd.externalId;
                    } else {
                        product.mercadoLibreId = extProd.externalId;
                    }

                    await productRepo().save(product);
                    updated++;
                } else {
                    // Product exists but from different source - skip to avoid duplicating
                    console.log(`[Import] Skipping ${extProd.title} - already exists from different source`);
                    skipped++;
                }
            } else {
                // Create new
                product = productRepo().create({
                    sku: extProd.sku,
                    title: extProd.title,
                    description: extProd.description,
                    price: extProd.price,
                    salePrice: extProd.salePrice,
                    stock: extProd.stock,
                    images: extProd.images,
                    category: extProd.category,
                    brand: extProd.brand,
                    condition: extProd.condition || "new",
                    woocommerceId: marketplace === "woocommerce" ? extProd.externalId : undefined,
                    mercadoLibreId: marketplace === "mercadolibre" ? extProd.externalId : undefined,
                    lastSyncedAt: new Date(),
                });
                await productRepo().save(product);
                imported++;
            }
        }

        res.json({ success: true, imported, updated, skipped, total: externalProducts.length });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Import failed" });
    }
});

// Sync single product to marketplace
router.post("/:id/sync/:marketplace", async (req: Request, res: Response) => {
    try {
        const { id, marketplace } = req.params;
        const product = await productRepo().findOneBy({ id: parseInt(id) });

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        const connection = await connectionRepo().findOneBy({ marketplace });
        if (!connection || !connection.isConnected) {
            return res.status(400).json({ error: `${marketplace} not connected` });
        }

        let adapter;
        let externalId: string | undefined;

        if (marketplace === "woocommerce") {
            adapter = new WooCommerceAdapter({
                apiUrl: connection.apiUrl,
                apiKey: connection.apiKey,
                apiSecret: connection.apiSecret,
            });
            externalId = product.woocommerceId;
        } else if (marketplace === "mercadolibre") {
            adapter = new MercadoLibreAdapter({
                accessToken: connection.accessToken,
                userId: connection.userId,
            });
            externalId = product.mercadoLibreId;
        } else {
            return res.status(400).json({ error: "Unknown marketplace" });
        }

        const productData = {
            sku: product.sku,
            title: product.title,
            description: product.description || "",
            price: Number(product.price),
            salePrice: product.salePrice ? Number(product.salePrice) : undefined,
            stock: product.stock,
            images: product.images || [],
            brand: product.brand,
            condition: product.condition as "new" | "used",
            weight: product.weight ? Number(product.weight) : undefined,
            dimensions: product.dimensions,
            status: product.status as "active" | "paused",
        };

        let result;
        if (externalId) {
            // Update existing
            result = await adapter.updateProduct(externalId, productData);
        } else {
            // Create new
            result = await adapter.createProduct(productData);

            // Save external ID
            if (marketplace === "woocommerce") {
                product.woocommerceId = result.externalId;
            } else {
                product.mercadoLibreId = result.externalId;
            }
        }

        product.lastSyncedAt = new Date();
        await productRepo().save(product);

        res.json({ success: true, externalId: result.externalId });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Sync failed" });
    }
});

// ========== Product Grouping ==========

// Get products grouped by groupId
router.get("/grouped/list", async (req: Request, res: Response) => {
    try {
        const products = await productRepo().find({
            order: { groupId: "ASC", updatedAt: "DESC" },
        });

        // Group products by groupId
        const groups: Record<string, any> = {};
        const ungrouped: any[] = [];

        for (const product of products) {
            if (product.groupId) {
                if (!groups[product.groupId]) {
                    groups[product.groupId] = {
                        groupId: product.groupId,
                        products: [],
                        totalStock: 0,
                        totalValue: 0,
                        costPrice: null,
                    };
                }
                groups[product.groupId].products.push(product);
                // Use the first product's costPrice for the group
                if (!groups[product.groupId].costPrice && product.costPrice) {
                    groups[product.groupId].costPrice = product.costPrice;
                }
            } else {
                ungrouped.push(product);
            }
        }

        // Calculate totals for each group
        for (const groupId in groups) {
            const group = groups[groupId];
            // Stock is shared - use the max stock among all ads
            group.totalStock = Math.max(...group.products.map((p: Product) => p.stock));
            if (group.costPrice) {
                group.totalValue = group.totalStock * Number(group.costPrice);
            }
        }

        res.json({
            groups: Object.values(groups),
            ungrouped,
            totalGroups: Object.keys(groups).length,
            totalUngrouped: ungrouped.length,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Set group for a product
router.post("/:id/group", async (req: Request, res: Response) => {
    try {
        const { groupId } = req.body;
        const product = await productRepo().findOneBy({ id: parseInt(req.params.id) });

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        product.groupId = groupId || null;
        await productRepo().save(product);

        // If setting a group, sync stock with other products in the same group
        if (groupId) {
            const groupProducts = await productRepo().find({
                where: { groupId },
            });

            // Use the highest stock value as the shared stock
            const maxStock = Math.max(...groupProducts.map(p => p.stock));

            // Update all products in the group with the same stock
            for (const p of groupProducts) {
                if (p.stock !== maxStock) {
                    p.stock = maxStock;
                    await productRepo().save(p);
                }
            }

            res.json({
                success: true,
                product,
                groupStock: maxStock,
                productsInGroup: groupProducts.length,
            });
        } else {
            res.json({ success: true, product });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update stock for entire group
router.post("/group/:groupId/stock", async (req: Request, res: Response) => {
    try {
        const { groupId } = req.params;
        const { stock } = req.body;

        if (stock === undefined) {
            return res.status(400).json({ error: "Stock value required" });
        }

        const products = await productRepo().find({
            where: { groupId },
        });

        if (products.length === 0) {
            return res.status(404).json({ error: "Group not found" });
        }

        // Update all products in the group
        for (const product of products) {
            product.stock = stock;
            await productRepo().save(product);
        }

        res.json({
            success: true,
            groupId,
            stock,
            productsUpdated: products.length,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
