import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ProductController } from "../controllers/ProductController";
import { validateRequest, validateBody, validateParams } from "../middlewares/validation";
import { productUpdateSchema, marketplaceParamSchema, idParamSchema, productSyncSchema } from "../validations/schemas";
import { syncScheduler } from "../services/SyncScheduler";

const router = Router();
const productController = new ProductController();

// Get all local products
router.get("/", productController.getAll.bind(productController));

// ========== Product Grouping (MUST be before /:id to avoid conflict) ==========

// Get products grouped by groupId
router.get("/groups", productController.getGroups.bind(productController));

// Update stock for entire group
router.post(
    "/groups/:groupId/stock",
    validateParams(z.object({ groupId: z.string().min(1) })),
    productController.updateGroupStock.bind(productController)
);

// Get single product (MUST be after /groups routes)
router.get(
    "/:id",
    validateParams(idParamSchema),
    productController.getOne.bind(productController)
);

// Create product
router.post(
    "/",
    validateBody(z.object({
        sku: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        price: z.number().positive(),
        salePrice: z.number().positive().optional(),
        stock: z.number().int().min(0).optional(),
        images: z.array(z.string().url()).optional(),
    })),
    productController.create.bind(productController)
);

// Update product (with auto-sync to marketplaces)
router.put(
    "/:id",
    validateParams(idParamSchema),
    validateBody(productUpdateSchema),
    productController.update.bind(productController)
);

// Delete product
router.delete(
    "/:id",
    validateParams(idParamSchema),
    productController.delete.bind(productController)
);

// Import products from a marketplace
router.post(
    "/import/:marketplace",
    validateParams(marketplaceParamSchema),
    validateRequest({ query: productSyncSchema }),
    productController.importProducts.bind(productController)
);

// Sync single product to marketplace
router.post(
    "/:id/sync/:marketplace",
    validateParams(z.object({
        id: z.string().uuid(),
        marketplace: z.enum(["woocommerce", "mercadolibre", "amazon"])
    })),
    productController.syncProduct.bind(productController)
);

// Get sync status (from scheduler)
router.get("/sync/status", async (_req: Request, res: Response) => {
    try {
        const status = syncScheduler.getStatus();
        res.json(status ? [status] : []);
    } catch (error) {
        res.json([]);
    }
});

// Trigger sync for a marketplace
router.post(
    "/sync/:marketplace",
    validateParams(z.object({
        marketplace: z.enum(["woocommerce", "mercadolibre", "amazon"])
    })),
    async (req: Request, res: Response) => {
        try {
            const marketplace = req.params.marketplace;
            await syncScheduler.triggerSync(marketplace);
            res.json({
                success: true,
                message: `Sync triggered for ${marketplace}`,
                result: {
                    imported: 0,
                    updated: 0,
                    failed: 0,
                }
            });
        } catch (error) {
            res.status(500).json({ error: "Failed to trigger sync" });
        }
    }
);

export default router;
