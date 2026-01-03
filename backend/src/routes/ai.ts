import { Router } from "express";
import { AppDataSource } from "../data-source";
import { AdSuggestion } from "../entities/AdSuggestion";
import { adSuggestionService } from "../services/AdSuggestionService";
import { agentOrchestrator } from "../ai/AgentOrchestrator";

const router = Router();

/**
 * Get AI providers status
 */
router.get("/status", async (req: any, res: any) => {
    try {
        const status = agentOrchestrator.getStatus();
        const tests = await agentOrchestrator.testAllProviders();

        res.json({
            ...status,
            providerStatus: tests,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Generate suggestions for a product
 */
router.post("/generate/:productId", async (req: any, res: any) => {
    try {
        const productId = parseInt(req.params.productId);
        const suggestions = await adSuggestionService.generateSuggestions(productId);

        res.json({
            success: true,
            count: suggestions.length,
            suggestions,
        });
    } catch (error: any) {
        console.error("[AI Routes] Generate error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all pending suggestions
 */
router.get("/suggestions", async (req: any, res: any) => {
    try {
        const suggestions = await adSuggestionService.getPendingSuggestions();
        res.json(suggestions);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get suggestions for a specific product
 */
router.get("/suggestions/product/:productId", async (req: any, res: any) => {
    try {
        const productId = parseInt(req.params.productId);
        const suggestions = await adSuggestionService.getSuggestionsByProduct(productId);
        res.json(suggestions);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get a single suggestion
 */
router.get("/suggestions/:id", async (req: any, res: any) => {
    try {
        const repo = AppDataSource.getRepository(AdSuggestion);
        const suggestion = await repo.findOne({
            where: { id: parseInt(req.params.id) },
            relations: ["product"],
        });

        if (!suggestion) {
            return res.status(404).json({ error: "Suggestion not found" });
        }

        res.json(suggestion);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update a suggestion (before approval)
 */
router.put("/suggestions/:id", async (req: any, res: any) => {
    try {
        const repo = AppDataSource.getRepository(AdSuggestion);
        const suggestion = await repo.findOneBy({ id: parseInt(req.params.id) });

        if (!suggestion) {
            return res.status(404).json({ error: "Suggestion not found" });
        }

        if (suggestion.status !== "pending") {
            return res.status(400).json({ error: "Can only edit pending suggestions" });
        }

        // Allow editing title, description, price
        if (req.body.suggestedTitle) suggestion.suggestedTitle = req.body.suggestedTitle;
        if (req.body.suggestedDescription) suggestion.suggestedDescription = req.body.suggestedDescription;
        if (req.body.suggestedPrice) suggestion.suggestedPrice = req.body.suggestedPrice;

        await repo.save(suggestion);
        res.json(suggestion);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Approve a suggestion
 */
router.post("/suggestions/:id/approve", async (req: any, res: any) => {
    try {
        const suggestion = await adSuggestionService.approveSuggestion(parseInt(req.params.id));
        res.json({ success: true, suggestion });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Reject a suggestion
 */
router.post("/suggestions/:id/reject", async (req: any, res: any) => {
    try {
        const suggestion = await adSuggestionService.rejectSuggestion(parseInt(req.params.id));
        res.json({ success: true, suggestion });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create ad in Mercado Libre (after approval)
 * TODO: Implement actual ML API call
 */
router.post("/suggestions/:id/create-in-ml", async (req: any, res: any) => {
    try {
        const repo = AppDataSource.getRepository(AdSuggestion);
        const suggestion = await repo.findOne({
            where: { id: parseInt(req.params.id) },
            relations: ["product"],
        });

        if (!suggestion) {
            return res.status(404).json({ error: "Suggestion not found" });
        }

        if (suggestion.status !== "approved") {
            return res.status(400).json({ error: "Suggestion must be approved first" });
        }

        // TODO: Call MercadoLibreAdapter.createProduct() here
        // For now, just mark as created
        suggestion.status = "created";
        suggestion.createdInMlAt = new Date();
        // suggestion.mlListingId = result.id;

        await repo.save(suggestion);

        res.json({
            success: true,
            message: "Listing creation queued (implementation pending)",
            suggestion,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Bulk approve suggestions
 */
router.post("/suggestions/bulk-approve", async (req: any, res: any) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids)) {
            return res.status(400).json({ error: "ids must be an array" });
        }

        const results = [];
        for (const id of ids) {
            try {
                const suggestion = await adSuggestionService.approveSuggestion(id);
                results.push({ id, success: true });
            } catch (e: any) {
                results.push({ id, success: false, error: e.message });
            }
        }

        res.json({ results });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
