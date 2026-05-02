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
const data_source_1 = require("../data-source");
const AdSuggestion_1 = require("../entities/AdSuggestion");
const AdSuggestionService_1 = require("../services/AdSuggestionService");
const AgentOrchestrator_1 = require("../ai/AgentOrchestrator");
const validation_1 = require("../middlewares/validation");
const schemas_1 = require("../validations/schemas");
const AISettings_1 = require("../entities/AISettings");
const router = (0, express_1.Router)();
/**
 * Get AI providers status
 */
router.get("/status", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const status = AgentOrchestrator_1.agentOrchestrator.getStatus();
        const tests = yield AgentOrchestrator_1.agentOrchestrator.testAllProviders();
        res.json(Object.assign(Object.assign({}, status), { providerStatus: tests }));
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Generate suggestions for a product
 */
router.post("/generate/:productId", (0, validation_1.validateParams)(zod_1.z.object({ productId: zod_1.z.string().regex(/^\d+$/, "ID inválido") })), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const productId = parseInt(req.params.productId, 10);
        const suggestions = yield AdSuggestionService_1.adSuggestionService.generateSuggestions(productId);
        res.json({
            success: true,
            count: suggestions.length,
            suggestions,
        });
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Get all pending suggestions
 */
router.get("/suggestions", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const suggestions = yield AdSuggestionService_1.adSuggestionService.getPendingSuggestions();
        res.json(suggestions);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Get suggestions for a specific product
 */
router.get("/suggestions/product/:productId", (0, validation_1.validateParams)(zod_1.z.object({ productId: zod_1.z.string().regex(/^\d+$/, "ID inválido") })), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const productId = parseInt(req.params.productId, 10);
        const suggestions = yield AdSuggestionService_1.adSuggestionService.getSuggestionsByProduct(productId);
        res.json(suggestions);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Get a single suggestion
 */
router.get("/suggestions/:id", (0, validation_1.validateParams)(schemas_1.idParamSchema), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const repo = data_source_1.AppDataSource.getRepository(AdSuggestion_1.AdSuggestion);
        const suggestion = yield repo.findOne({
            where: { id: parseInt(req.params.id, 10) },
            relations: ["product"],
        });
        if (!suggestion) {
            return res.status(404).json({ error: "Suggestion not found" });
        }
        res.json(suggestion);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Update a suggestion (before approval)
 */
router.put("/suggestions/:id", (0, validation_1.validateParams)(schemas_1.idParamSchema), (0, validation_1.validateBody)(zod_1.z.object({
    suggestedTitle: zod_1.z.string().min(1).optional(),
    suggestedDescription: zod_1.z.string().optional(),
    suggestedPrice: zod_1.z.number().positive().optional(),
})), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const repo = data_source_1.AppDataSource.getRepository(AdSuggestion_1.AdSuggestion);
        const suggestion = yield repo.findOneBy({ id: parseInt(req.params.id, 10) });
        if (!suggestion) {
            return res.status(404).json({ error: "Suggestion not found" });
        }
        if (suggestion.status !== "pending") {
            return res.status(400).json({ error: "Can only edit pending suggestions" });
        }
        const { suggestedTitle, suggestedDescription, suggestedPrice } = req.body;
        if (suggestedTitle !== undefined)
            suggestion.suggestedTitle = suggestedTitle;
        if (suggestedDescription !== undefined)
            suggestion.suggestedDescription = suggestedDescription;
        if (suggestedPrice !== undefined)
            suggestion.suggestedPrice = suggestedPrice;
        yield repo.save(suggestion);
        res.json(suggestion);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Approve a suggestion
 */
router.post("/suggestions/:id/approve", (0, validation_1.validateParams)(schemas_1.idParamSchema), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const suggestion = yield AdSuggestionService_1.adSuggestionService.approveSuggestion(parseInt(req.params.id, 10));
        res.json({ success: true, suggestion });
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Reject a suggestion
 */
router.post("/suggestions/:id/reject", (0, validation_1.validateParams)(schemas_1.idParamSchema), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const suggestion = yield AdSuggestionService_1.adSuggestionService.rejectSuggestion(parseInt(req.params.id, 10));
        res.json({ success: true, suggestion });
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Create ad in Mercado Libre (after approval)
 */
router.post("/suggestions/:id/create-in-ml", (0, validation_1.validateParams)(schemas_1.idParamSchema), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const repo = data_source_1.AppDataSource.getRepository(AdSuggestion_1.AdSuggestion);
        const suggestion = yield repo.findOne({
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
        yield repo.save(suggestion);
        res.json({
            success: true,
            message: "Listing creation queued (implementation pending)",
            suggestion,
        });
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Bulk approve suggestions
 */
router.post("/suggestions/bulk-approve", (0, validation_1.validateBody)(zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.number().int().positive()).min(1),
})), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { ids } = req.body;
        const results = [];
        for (const id of ids) {
            try {
                const suggestion = yield AdSuggestionService_1.adSuggestionService.approveSuggestion(id);
                results.push({ id, success: true });
            }
            catch (e) {
                const errorMessage = e instanceof Error ? e.message : "Unknown error";
                results.push({ id, success: false, error: errorMessage });
            }
        }
        res.json({ results });
    }
    catch (error) {
        next(error);
    }
}));
// ========== AI Settings Management ==========
/**
 * Get all AI settings
 */
router.get("/settings", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const repo = data_source_1.AppDataSource.getRepository(AISettings_1.AISettings);
        const settings = yield repo.find({ order: { priority: "ASC" } });
        // Mask API keys for security
        const masked = settings.map(s => (Object.assign(Object.assign({}, s), { apiKey: s.apiKey ? "***" + s.apiKey.slice(-4) : null })));
        res.json(masked);
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Save AI settings for a provider
 */
router.post("/settings/:provider", (0, validation_1.validateParams)(zod_1.z.object({
    provider: zod_1.z.enum(["openai", "gemini", "openrouter"]),
})), (0, validation_1.validateBody)(zod_1.z.object({
    apiKey: zod_1.z.string().min(10).optional(),
    model: zod_1.z.string().optional(),
    isEnabled: zod_1.z.boolean().optional(),
    priority: zod_1.z.number().int().min(1).optional(),
})), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const provider = req.params.provider;
        const { apiKey, model, isEnabled, priority } = req.body;
        const repo = data_source_1.AppDataSource.getRepository(AISettings_1.AISettings);
        let settings = yield repo.findOneBy({ provider });
        if (!settings) {
            settings = repo.create({ provider });
        }
        if (apiKey !== undefined && apiKey !== "")
            settings.apiKey = apiKey;
        if (model !== undefined)
            settings.model = model;
        if (isEnabled !== undefined)
            settings.isEnabled = isEnabled;
        if (priority !== undefined)
            settings.priority = priority;
        yield repo.save(settings);
        // Reload orchestrator
        yield reloadOrchestrator();
        res.json({
            success: true,
            provider,
            message: `${provider} settings saved`,
        });
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Delete AI settings for a provider
 */
router.delete("/settings/:provider", (0, validation_1.validateParams)(zod_1.z.object({
    provider: zod_1.z.enum(["openai", "gemini", "openrouter"]),
})), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const provider = req.params.provider;
        const repo = data_source_1.AppDataSource.getRepository(AISettings_1.AISettings);
        yield repo.delete({ provider });
        yield reloadOrchestrator();
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Test a specific AI provider
 */
router.post("/settings/:provider/test", (0, validation_1.validateParams)(zod_1.z.object({
    provider: zod_1.z.enum(["openai", "gemini", "openrouter"]),
})), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const provider = req.params.provider;
        const providerInstance = AgentOrchestrator_1.agentOrchestrator.getProvider(provider);
        if (!providerInstance) {
            return res.json({ success: false, message: `${provider} not configured` });
        }
        const working = yield providerInstance.testConnection();
        res.json({
            success: working,
            message: working ? `${provider} is working!` : `${provider} test failed`,
        });
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Helper: Reload orchestrator from database
 */
function reloadOrchestrator() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const repo = data_source_1.AppDataSource.getRepository(AISettings_1.AISettings);
            const allSettings = yield repo.find({
                where: { isEnabled: true },
                order: { priority: "ASC" },
            });
            // Clear existing providers first
            AgentOrchestrator_1.agentOrchestrator.clearProviders();
            // Reload from database
            for (const settings of allSettings) {
                if (settings.apiKey) {
                    AgentOrchestrator_1.agentOrchestrator.addProvider({
                        name: settings.provider,
                        apiKey: settings.apiKey,
                        model: settings.model,
                        priority: settings.priority,
                    });
                }
            }
            console.log(`[AI] Orchestrator reloaded with ${allSettings.length} providers from database`);
        }
        catch (e) {
            const errorMessage = e instanceof Error ? e.message : "Unknown error";
            console.error("[AI] Failed to reload orchestrator:", errorMessage);
        }
    });
}
exports.default = router;
