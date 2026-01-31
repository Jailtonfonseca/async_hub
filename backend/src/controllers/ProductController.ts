import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../data-source";
import { Product } from "../entities/Product";
import { Connection } from "../entities/Connection";
import { WooCommerceAdapter } from "../adapters/WooCommerceAdapter";
import { MercadoLibreAdapter } from "../adapters/MercadoLibreAdapter";
import { AmazonAdapter } from "../adapters/AmazonAdapter";

export class ProductController {
    private productRepo = AppDataSource.getRepository(Product);
    private connectionRepo = AppDataSource.getRepository(Connection);

    getAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const products = await this.productRepo.find({
                order: { updatedAt: "DESC" },
            });
            res.json(products);
        } catch (error) {
            next(error);
        }
    };

    getGroups = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const products = await this.productRepo.find({
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

            // Convert to array
            const groupsArray = [];
            for (const key in groups) {
                groupsArray.push(groups[key]);
            }

            res.json({
                groups: groupsArray,
                ungrouped,
                totalGroups: groupsArray.length,
                totalUngrouped: ungrouped.length,
            });
        } catch (error) {
            next(error);
        }
    };

    updateGroupStock = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { groupId } = req.params;
            const { stock } = req.body;

            if (stock === undefined) {
                return res.status(400).json({ error: "Stock value required" });
            }

            const products = await this.productRepo.find({
                where: { groupId },
            });

            if (products.length === 0) {
                return res.status(404).json({ error: "Group not found" });
            }

            const results: any[] = [];

            // Update all products in the group and sync
            for (const product of products) {
                const oldStock = product.stock;
                product.stock = stock;
                await this.productRepo.save(product);

                // Sync if stock changed
                if (Number(oldStock) !== Number(stock)) {
                    const syncResult = await this.syncToMarketplaces(product, { stockChanged: true });
                    results.push({ id: product.id, sku: product.sku, syncResult });
                }
            }

            res.json({
                success: true,
                groupId,
                stock,
                productsUpdated: products.length,
                results
            });
        } catch (error) {
            next(error);
        }
    };

    getOne = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const product = await this.productRepo.findOneBy({ id: parseInt(req.params.id) });
            if (!product) {
                return res.status(404).json({ error: "Product not found" });
            }
            res.json(product);
        } catch (error) {
            next(error);
        }
    };

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const product = this.productRepo.create(req.body);
            await this.productRepo.save(product);
            res.status(201).json(product);
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const product = await this.productRepo.findOneBy({ id: parseInt(req.params.id) });
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
            await this.productRepo.save(product);

            // Auto-sync to marketplaces if price or stock changed
            let syncResults = {};

            if (priceChanged || salePriceChanged || stockChanged) {
                console.log(`[ProductSync] Changes detected - price: ${priceChanged}, salePrice: ${salePriceChanged}, stock: ${stockChanged}`);

                // Sync THIS product
                syncResults = await this.syncToMarketplaces(product, { priceChanged, salePriceChanged, stockChanged });

                // Sync stock and costPrice to other products in the same group
                const costPriceChanged = req.body.costPrice !== undefined && Number(req.body.costPrice) !== Number(product.costPrice);

                if ((stockChanged || costPriceChanged) && product.groupId) {
                    const groupProducts = await this.productRepo.find({
                        where: { groupId: product.groupId },
                    });

                    let groupSynced = 0;
                    const groupResults: any = {};

                    for (const gp of groupProducts) {
                        if (gp.id !== product.id) {
                            let changed = false;
                            let groupStockChanged = false;

                            if (stockChanged && Number(gp.stock) !== Number(product.stock)) {
                                gp.stock = product.stock;
                                changed = true;
                                groupStockChanged = true;
                            }
                            if (costPriceChanged && Number(gp.costPrice) !== Number(product.costPrice)) {
                                gp.costPrice = product.costPrice;
                                changed = true;
                            }

                            if (changed) {
                                await this.productRepo.save(gp);
                                groupSynced++;

                                // CRITICAL FIX: If stock changed, we MUST sync this grouped product to its marketplace too!
                                if (groupStockChanged) {
                                    const gpSyncResult = await this.syncToMarketplaces(gp, { stockChanged: true });
                                    groupResults[gp.sku] = gpSyncResult;
                                }
                            }
                        }
                    }

                    if (groupSynced > 0) {
                        console.log(`[ProductSync] Updated stock/cost for ${groupSynced} products in group ${product.groupId}`);
                    }
                    (syncResults as any).groupPropagation = groupResults;
                }
            }

            res.json({ ...product, syncResults });
        } catch (error: any) {
            console.error("[ProductSync] Update error:", error);
            next(error);
        }
    };

    delete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.productRepo.delete({ id: parseInt(req.params.id) });
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    };

    importProducts = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { marketplace } = req.params;
            const connection = await this.connectionRepo.findOneBy({ marketplace });

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
                    product = await this.productRepo.findOneBy({ mercadoLibreId: extProd.externalId });
                } else if (marketplace === "woocommerce" && extProd.externalId) {
                    product = await this.productRepo.findOneBy({ woocommerceId: extProd.externalId });
                }

                // If not found by external ID, try by SKU
                if (!product && extProd.sku) {
                    product = await this.productRepo.findOneBy({ sku: extProd.sku });
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

                        await this.productRepo.save(product);
                        updated++;
                    } else {
                        // Product exists but from different source - skip to avoid duplicating
                        console.log(`[Import] Skipping ${extProd.title} - already exists from different source`);
                        skipped++;
                    }
                } else {
                    // Create new
                    product = this.productRepo.create({
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
                    await this.productRepo.save(product);
                    imported++;
                }
            }

            res.json({ success: true, imported, updated, skipped, total: externalProducts.length });
        } catch (error: any) {
            next(error);
        }
    };

    syncProduct = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id, marketplace } = req.params;
            const product = await this.productRepo.findOneBy({ id: parseInt(id) });

            if (!product) {
                return res.status(404).json({ error: "Product not found" });
            }

            const connection = await this.connectionRepo.findOneBy({ marketplace });
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
            await this.productRepo.save(product);

            res.json({ success: true, externalId: result.externalId });
        } catch (error: any) {
            next(error);
        }
    };

    // Helper method to sync a single product to all its connected marketplaces
    private async syncToMarketplaces(product: Product, changes: { priceChanged?: boolean; salePriceChanged?: boolean; stockChanged?: boolean }) {
        const syncResults: any = { woocommerce: null, mercadolibre: null, amazon: null };
        const { priceChanged, salePriceChanged, stockChanged } = changes;

        // Sync to WooCommerce
        if (product.woocommerceId) {
            try {
                const wcConnection = await this.connectionRepo.findOneBy({ marketplace: "woocommerce" });
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
                const mlConnection = await this.connectionRepo.findOneBy({ marketplace: "mercadolibre" });
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

        // Sync to Amazon
        if (product.amazonId) {
            try {
                const amazonConnection = await this.connectionRepo.findOneBy({ marketplace: "amazon" });
                if (amazonConnection && amazonConnection.isConnected) {
                    const amazonAdapter = new AmazonAdapter({
                        apiKey: amazonConnection.apiKey || "",
                        apiSecret: amazonConnection.apiSecret || "",
                        accessToken: amazonConnection.accessToken || "",
                        userId: amazonConnection.userId || "",
                        apiUrl: amazonConnection.apiUrl || "",
                        refreshToken: amazonConnection.refreshToken || "",
                    });

                    if (stockChanged) {
                        await amazonAdapter.updateStock(product.amazonId, product.stock);
                    }
                    if (priceChanged || salePriceChanged) {
                        await amazonAdapter.updatePrice(product.amazonId, Number(product.price), product.salePrice ? Number(product.salePrice) : undefined);
                    }

                    syncResults.amazon = "synced";
                    console.log(`[ProductSync] Synced to Amazon: ${product.sku}`);
                }
            } catch (e: any) {
                syncResults.amazon = `error: ${e.message}`;
                console.error(`[ProductSync] Amazon sync error: ${e.message}`);
            }
        }

        return syncResults;
    }
}
