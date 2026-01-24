import { Router } from "express";
import { ProductController } from "../controllers/ProductController";

const router = Router();
const productController = new ProductController();

// Get all local products
router.get("/", productController.getAll);

// ========== Product Grouping (MUST be before /:id to avoid conflict) ==========

// Get products grouped by groupId
router.get("/groups", productController.getGroups);

// Update stock for entire group
router.post("/groups/:groupId/stock", productController.updateGroupStock);

// Get single product (MUST be after /groups routes)
router.get("/:id", productController.getOne);

// Create product
router.post("/", productController.create);

// Update product (with auto-sync to marketplaces)
router.put("/:id", productController.update);

// Delete product
router.delete("/:id", productController.delete);

// Import products from a marketplace
router.post("/import/:marketplace", productController.importProducts);

// Sync single product to marketplace
router.post("/:id/sync/:marketplace", productController.syncProduct);

export default router;
