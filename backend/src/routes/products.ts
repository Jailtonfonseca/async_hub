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

// Update product
router.put("/:id", async (req: Request, res: Response) => {
    try {
        const product = await productRepo().findOneBy({ id: parseInt(req.params.id) });
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        Object.assign(product, req.body);
        await productRepo().save(product);
        res.json(product);
    } catch (error) {
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

        for (const extProd of externalProducts) {
            let product = await productRepo().findOneBy({ sku: extProd.sku });

            if (product) {
                // Update existing
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

                updated++;
            } else {
                // Create new
                product = productRepo().create({
                    ...extProd,
                    woocommerceId: marketplace === "woocommerce" ? extProd.externalId : undefined,
                    mercadoLibreId: marketplace === "mercadolibre" ? extProd.externalId : undefined,
                    lastSyncedAt: new Date(),
                });
                imported++;
            }

            await productRepo().save(product);
        }

        res.json({ success: true, imported, updated, total: externalProducts.length });
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

export default router;
