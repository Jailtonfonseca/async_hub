import { Router } from "express";
import { AppDataSource } from "../data-source";
import { AdSuggestion } from "../entities/AdSuggestion";
import { adSuggestionService } from "../services/AdSuggestionService";
import { agentOrchestrator } from "../ai/AgentOrchestrator";
import { Product } from "../entities/Product";
import { Connection } from "../entities/Connection";
import { MercadoLibreAdapter } from "../adapters/MercadoLibreAdapter";
import { IProduct } from "../interfaces/IMarketplace";

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

        // Create IProduct payload by merging original product with suggestion
        const productRepo = AppDataSource.getRepository(Product);
        const originalProduct = await productRepo.findOneBy({ id: suggestion.productId });

        if (!originalProduct) {
            return res.status(404).json({ error: "Original product not found" });
        }

        const connectionRepo = AppDataSource.getRepository(Connection);
        const connection = await connectionRepo.findOneBy({ marketplace: "mercadolibre" });

        if (!connection || !connection.accessToken) {
            return res.status(400).json({ error: "Mercado Libre is not connected" });
        }

        // Logic to create in ML
        const adapter = new MercadoLibreAdapter({
            accessToken: connection.accessToken,
            userId: connection.userId || ""
        });

        // Construct payload
        const payload: IProduct = {
            ...originalProduct,
            title: suggestion.suggestedTitle,
            price: Number(suggestion.suggestedPrice),
            description: suggestion.suggestedDescription || originalProduct.description || "",
            // Ensure distinct SKU or handle logic to link it back
            sku: `${originalProduct.sku}-${suggestion.type}-${Date.now().toString().slice(-4)}`,
            stock: suggestion.stockRequired || 1,
            images: originalProduct.images || [],
            listingType: suggestion.type === "premium" ? "premium" : "classic",
            condition: (originalProduct.condition === "used" ? "used" : "new") as "new" | "used",
        };

        if (suggestion.type === "premium") {
            payload.listingType = "premium";
        } else {
            payload.listingType = "classic";
        }

        const createdProduct = await adapter.createProduct(payload);

        // Update suggestion status
        suggestion.status = "created";
        suggestion.createdInMlAt = new Date();
        suggestion.mlListingId = createdProduct.externalId;

        await repo.save(suggestion);

        res.json({
            success: true,
            message: "Listing created in Mercado Libre",
            suggestion,
            mlProduct: createdProduct
        });
    } catch (error: any) {
        console.error("[AI] Create in ML error:", error);
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

// ========== AI Settings Management ==========

import { AISettings, AIProvider } from "../entities/AISettings";

/**
 * Get all AI settings
 */
router.get("/settings", async (req: any, res: any) => {
    try {
        const repo = AppDataSource.getRepository(AISettings);
        const settings = await repo.find({ order: { priority: "ASC" } });

        // Mask API keys for security
        const masked = settings.map(s => ({
            ...s,
            apiKey: s.apiKey ? "***" + s.apiKey.slice(-4) : null,
        }));

        res.json(masked);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Save AI settings for a provider
 */
router.post("/settings/:provider", async (req: any, res: any) => {
    try {
        const provider = req.params.provider as AIProvider;
        const { apiKey, model, isEnabled, priority } = req.body;

        if (!["openai", "gemini", "openrouter"].includes(provider)) {
            return res.status(400).json({ error: "Invalid provider" });
        }

        const repo = AppDataSource.getRepository(AISettings);
        let settings = await repo.findOneBy({ provider });

        if (!settings) {
            settings = repo.create({ provider });
        }

        if (apiKey !== undefined && apiKey !== "") settings.apiKey = apiKey;
        if (model !== undefined) settings.model = model;
        if (isEnabled !== undefined) settings.isEnabled = isEnabled;
        if (priority !== undefined) settings.priority = priority;

        await repo.save(settings);

        // Reload orchestrator
        await reloadOrchestrator();

        res.json({
            success: true,
            provider,
            message: `${provider} settings saved`
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Delete AI settings for a provider
 */
router.delete("/settings/:provider", async (req: any, res: any) => {
    try {
        const provider = req.params.provider;
        const repo = AppDataSource.getRepository(AISettings);
        await repo.delete({ provider });

        await reloadOrchestrator();

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Test a specific AI provider
 */
router.post("/settings/:provider/test", async (req: any, res: any) => {
    try {
        const provider = req.params.provider as AIProvider;
        const providerInstance = agentOrchestrator.getProvider(provider);

        if (!providerInstance) {
            return res.json({ success: false, message: `${provider} not configured` });
        }

        const working = await providerInstance.testConnection();
        res.json({
            success: working,
            message: working ? `${provider} is working!` : `${provider} test failed`
        });
    } catch (error: any) {
        res.json({ success: false, message: error.message });
    }
});

/**
 * Helper: Reload orchestrator from database
 */
async function reloadOrchestrator() {
    try {
        const repo = AppDataSource.getRepository(AISettings);
        const allSettings = await repo.find({
            where: { isEnabled: true },
            order: { priority: "ASC" }
        });

        // Clear existing providers first
        agentOrchestrator.clearProviders();

        // Reload from database
        for (const settings of allSettings) {
            if (settings.apiKey) {
                agentOrchestrator.addProvider({
                    name: settings.provider,
                    apiKey: settings.apiKey,
                    model: settings.model,
                    priority: settings.priority,
                });
            }
        }

        console.log(`[AI] Orchestrator reloaded with ${allSettings.length} providers from database`);
    } catch (e) {
        console.error("[AI] Failed to reload orchestrator:", e);
    }
}

export default router;
