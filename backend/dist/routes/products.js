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
const express_1 = require("express");
const zod_1 = require("zod");
const ProductController_1 = require("../controllers/ProductController");
const validation_1 = require("../middlewares/validation");
const schemas_1 = require("../validations/schemas");
const SyncScheduler_1 = require("../services/SyncScheduler");
const router = (0, express_1.Router)();
const productController = new ProductController_1.ProductController();
// Get all local products
router.get("/", productController.getAll.bind(productController));
// ========== Product Grouping (MUST be before /:id to avoid conflict) ==========
// Get products grouped by groupId
router.get("/groups", productController.getGroups.bind(productController));
// Update stock for entire group
router.post("/groups/:groupId/stock", (0, validation_1.validateParams)(zod_1.z.object({ groupId: zod_1.z.string().min(1) })), productController.updateGroupStock.bind(productController));
// Get single product (MUST be after /groups routes)
router.get("/:id", (0, validation_1.validateParams)(schemas_1.idParamSchema), productController.getOne.bind(productController));
// Create product
router.post("/", (0, validation_1.validateBody)(zod_1.z.object({
    sku: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    price: zod_1.z.number().positive(),
    salePrice: zod_1.z.number().positive().optional(),
    stock: zod_1.z.number().int().min(0).optional(),
    images: zod_1.z.array(zod_1.z.string().url()).optional(),
})), productController.create.bind(productController));
// Update product (with auto-sync to marketplaces)
router.put("/:id", (0, validation_1.validateParams)(schemas_1.idParamSchema), (0, validation_1.validateBody)(schemas_1.productUpdateSchema), productController.update.bind(productController));
// Delete product
router.delete("/:id", (0, validation_1.validateParams)(schemas_1.idParamSchema), productController.delete.bind(productController));
// Import products from a marketplace
router.post("/import/:marketplace", (0, validation_1.validateParams)(schemas_1.marketplaceParamSchema), (0, validation_1.validateRequest)({ query: schemas_1.productSyncSchema }), productController.importProducts.bind(productController));
// Sync single product to marketplace
router.post("/:id/sync/:marketplace", (0, validation_1.validateParams)(zod_1.z.object({
    id: zod_1.z.string().uuid(),
    marketplace: zod_1.z.enum(["woocommerce", "mercadolibre", "amazon"])
})), productController.syncProduct.bind(productController));
// Get sync status (from scheduler)
router.get("/sync/status", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const status = SyncScheduler_1.syncScheduler.getStatus();
        res.json(status ? [status] : []);
    }
    catch (error) {
        res.json([]);
    }
}));
// Trigger sync for a marketplace
router.post("/sync/:marketplace", (0, validation_1.validateParams)(zod_1.z.object({
    marketplace: zod_1.z.enum(["woocommerce", "mercadolibre", "amazon"])
})), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const marketplace = req.params.marketplace;
        yield SyncScheduler_1.syncScheduler.triggerSync(marketplace);
        res.json({ success: true, message: `Sync triggered for ${marketplace}` });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to trigger sync" });
    }
}));
exports.default = router;
