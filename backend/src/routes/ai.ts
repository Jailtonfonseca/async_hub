import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppDataSource } from "../data-source";
import { AdSuggestion } from "../entities/AdSuggestion";
import { adSuggestionService } from "../services/AdSuggestionService";
import { agentOrchestrator } from "../ai/AgentOrchestrator";
import { validateParams, validateBody, validateRequest } from "../middlewares/validation";
import { aiSuggestionSchema, marketplaceParamSchema, idParamSchema } from "../validations/schemas";
import { AISettings, AIProvider } from "../entities/AISettings";

const router = Router();

/**
 * Get AI providers status
 */
router.get("/status", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const status = agentOrchestrator.getStatus();
        const tests = await agentOrchestrator.testAllProviders();

        res.json({
            ...status,
            providerStatus: tests,
        });
    } catch (error: unknown) {
        next(error);
    }
});

/**
 * Generate suggestions for a product
 */
router.post(
    "/generate/:productId",
    validateParams(z.object({ productId: z.string().regex(/^\d+$/, "ID inválido") })),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const productId = parseInt(req.params.productId, 10);
            const suggestions = await adSuggestionService.generateSuggestions(productId);

            res.json({
                success: true,
                count: suggestions.length,
                suggestions,
            });
        } catch (error: unknown) {
            next(error);
        }
    }
);

/**
 * Get all pending suggestions
 */
router.get("/suggestions", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const suggestions = await adSuggestionService.getPendingSuggestions();
        res.json(suggestions);
    } catch (error: unknown) {
        next(error);
    }
});

/**
 * Get suggestions for a specific product
 */
router.get(
    "/suggestions/product/:productId",
    validateParams(z.object({ productId: z.string().regex(/^\d+$/, "ID inválido") })),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const productId = parseInt(req.params.productId, 10);
            const suggestions = await adSuggestionService.getSuggestionsByProduct(productId);
            res.json(suggestions);
        } catch (error: unknown) {
            next(error);
        }
    }
);

/**
 * Get a single suggestion
 */
router.get(
    "/suggestions/:id",
    validateParams(idParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const repo = AppDataSource.getRepository(AdSuggestion);
            const suggestion = await repo.findOne({
                where: { id: parseInt(req.params.id, 10) },
                relations: ["product"],
            });

            if (!suggestion) {
                return res.status(404).json({ error: "Suggestion not found" });
            }

            res.json(suggestion);
        } catch (error: unknown) {
            next(error);
        }
    }
);

/**
 * Update a suggestion (before approval)
 */
router.put(
    "/suggestions/:id",
    validateParams(idParamSchema),
    validateBody(z.object({
        suggestedTitle: z.string().min(1).optional(),
        suggestedDescription: z.string().optional(),
        suggestedPrice: z.number().positive().optional(),
    })),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const repo = AppDataSource.getRepository(AdSuggestion);
            const suggestion = await repo.findOneBy({ id: parseInt(req.params.id, 10) });

            if (!suggestion) {
                return res.status(404).json({ error: "Suggestion not found" });
            }

            if (suggestion.status !== "pending") {
                return res.status(400).json({ error: "Can only edit pending suggestions" });
            }

            const { suggestedTitle, suggestedDescription, suggestedPrice } = req.body;

            if (suggestedTitle !== undefined) suggestion.suggestedTitle = suggestedTitle;
            if (suggestedDescription !== undefined) suggestion.suggestedDescription = suggestedDescription;
            if (suggestedPrice !== undefined) suggestion.suggestedPrice = suggestedPrice;

            await repo.save(suggestion);
            res.json(suggestion);
        } catch (error: unknown) {
            next(error);
        }
    }
);

/**
 * Approve a suggestion
 */
router.post(
    "/suggestions/:id/approve",
    validateParams(idParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const suggestion = await adSuggestionService.approveSuggestion(parseInt(req.params.id, 10));
            res.json({ success: true, suggestion });
        } catch (error: unknown) {
            next(error);
        }
    }
);

/**
 * Reject a suggestion
 */
router.post(
    "/suggestions/:id/reject",
    validateParams(idParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const suggestion = await adSuggestionService.rejectSuggestion(parseInt(req.params.id, 10));
            res.json({ success: true, suggestion });
        } catch (error: unknown) {
            next(error);
        }
    }
);

/**
 * Create ad in Mercado Libre (after approval)
 */
router.post(
    "/suggestions/:id/create-in-ml",
    validateParams(idParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const repo = AppDataSource.getRepository(AdSuggestion);
            const suggestion = await repo.findOne({
                where: { id: parseInt(req.params.id, 10) },
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

            await repo.save(suggestion);

            res.json({
                success: true,
                message: "Listing creation queued (implementation pending)",
                suggestion,
            });
        } catch (error: unknown) {
            next(error);
        }
    }
);

/**
 * Bulk approve suggestions
 */
router.post(
    "/suggestions/bulk-approve",
    validateBody(z.object({
        ids: z.array(z.number().int().positive()).min(1),
    })),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { ids } = req.body;
            const results: Array<{ id: number; success: boolean; error?: string }> = [];

            for (const id of ids) {
                try {
                    const suggestion = await adSuggestionService.approveSuggestion(id);
                    results.push({ id, success: true });
                } catch (e: unknown) {
                    const errorMessage = e instanceof Error ? e.message : "Unknown error";
                    results.push({ id, success: false, error: errorMessage });
                }
            }

            res.json({ results });
        } catch (error: unknown) {
            next(error);
        }
    }
);

// ========== AI Settings Management ==========

/**
 * Get all AI settings
 */
router.get("/settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const repo = AppDataSource.getRepository(AISettings);
        const settings = await repo.find({ order: { priority: "ASC" } });

        // Mask API keys for security
        const masked = settings.map(s => ({
            ...s,
            apiKey: s.apiKey ? "***" + s.apiKey.slice(-4) : null,
        }));

        res.json(masked);
    } catch (error: unknown) {
        next(error);
    }
});

/**
 * Save AI settings for a provider
 */
router.post(
    "/settings/:provider",
    validateParams(z.object({
        provider: z.enum(["openai", "gemini", "openrouter"]),
    })),
    validateBody(z.object({
        apiKey: z.string().min(10).optional(),
        model: z.string().optional(),
        isEnabled: z.boolean().optional(),
        priority: z.number().int().min(1).optional(),
    })),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const provider = req.params.provider as AIProvider;
            const { apiKey, model, isEnabled, priority } = req.body;

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
                message: `${provider} settings saved`,
            });
        } catch (error: unknown) {
            next(error);
        }
    }
);

/**
 * Delete AI settings for a provider
 */
router.delete(
    "/settings/:provider",
    validateParams(z.object({
        provider: z.enum(["openai", "gemini", "openrouter"]),
    })),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const provider = req.params.provider as AIProvider;
            const repo = AppDataSource.getRepository(AISettings);
            await repo.delete({ provider });

            await reloadOrchestrator();

            res.json({ success: true });
        } catch (error: unknown) {
            next(error);
        }
    }
);

/**
 * Test a specific AI provider
 */
router.post(
    "/settings/:provider/test",
    validateParams(z.object({
        provider: z.enum(["openai", "gemini", "openrouter"]),
    })),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const provider = req.params.provider as AIProvider;
            const providerInstance = agentOrchestrator.getProvider(provider);

            if (!providerInstance) {
                return res.json({ success: false, message: `${provider} not configured` });
            }

            const working = await providerInstance.testConnection();
            res.json({
                success: working,
                message: working ? `${provider} is working!` : `${provider} test failed`,
            });
        } catch (error: unknown) {
            next(error);
        }
    }
);

/**
 * Helper: Reload orchestrator from database
 */
async function reloadOrchestrator(): Promise<void> {
    try {
        const repo = AppDataSource.getRepository(AISettings);
        const allSettings = await repo.find({
            where: { isEnabled: true },
            order: { priority: "ASC" },
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
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        console.error("[AI] Failed to reload orchestrator:", errorMessage);
    }
}

export default router;
