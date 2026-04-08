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
const data_source_1 = require("../data-source");
const AdSuggestion_1 = require("../entities/AdSuggestion");
const AdSuggestionService_1 = require("../services/AdSuggestionService");
const AgentOrchestrator_1 = require("../ai/AgentOrchestrator");
const router = (0, express_1.Router)();
/**
 * Get AI providers status
 */
router.get("/status", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const status = AgentOrchestrator_1.agentOrchestrator.getStatus();
        const tests = yield AgentOrchestrator_1.agentOrchestrator.testAllProviders();
        res.json(Object.assign(Object.assign({}, status), { providerStatus: tests }));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
/**
 * Generate suggestions for a product
 */
router.post("/generate/:productId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const productId = parseInt(req.params.productId);
        const suggestions = yield AdSuggestionService_1.adSuggestionService.generateSuggestions(productId);
        res.json({
            success: true,
            count: suggestions.length,
            suggestions,
        });
    }
    catch (error) {
        console.error("[AI Routes] Generate error:", error);
        res.status(500).json({ error: error.message });
    }
}));
/**
 * Get all pending suggestions
 */
router.get("/suggestions", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const suggestions = yield AdSuggestionService_1.adSuggestionService.getPendingSuggestions();
        res.json(suggestions);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
/**
 * Get suggestions for a specific product
 */
router.get("/suggestions/product/:productId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const productId = parseInt(req.params.productId);
        const suggestions = yield AdSuggestionService_1.adSuggestionService.getSuggestionsByProduct(productId);
        res.json(suggestions);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
/**
 * Get a single suggestion
 */
router.get("/suggestions/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const repo = data_source_1.AppDataSource.getRepository(AdSuggestion_1.AdSuggestion);
        const suggestion = yield repo.findOne({
            where: { id: parseInt(req.params.id) },
            relations: ["product"],
        });
        if (!suggestion) {
            return res.status(404).json({ error: "Suggestion not found" });
        }
        res.json(suggestion);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
/**
 * Update a suggestion (before approval)
 */
router.put("/suggestions/:id", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const repo = data_source_1.AppDataSource.getRepository(AdSuggestion_1.AdSuggestion);
        const suggestion = yield repo.findOneBy({ id: parseInt(req.params.id) });
        if (!suggestion) {
            return res.status(404).json({ error: "Suggestion not found" });
        }
        if (suggestion.status !== "pending") {
            return res.status(400).json({ error: "Can only edit pending suggestions" });
        }
        // Allow editing title, description, price
        if (req.body.suggestedTitle)
            suggestion.suggestedTitle = req.body.suggestedTitle;
        if (req.body.suggestedDescription)
            suggestion.suggestedDescription = req.body.suggestedDescription;
        if (req.body.suggestedPrice)
            suggestion.suggestedPrice = req.body.suggestedPrice;
        yield repo.save(suggestion);
        res.json(suggestion);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
/**
 * Approve a suggestion
 */
router.post("/suggestions/:id/approve", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const suggestion = yield AdSuggestionService_1.adSuggestionService.approveSuggestion(parseInt(req.params.id));
        res.json({ success: true, suggestion });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
/**
 * Reject a suggestion
 */
router.post("/suggestions/:id/reject", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const suggestion = yield AdSuggestionService_1.adSuggestionService.rejectSuggestion(parseInt(req.params.id));
        res.json({ success: true, suggestion });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
/**
 * Create ad in Mercado Libre (after approval)
 * TODO: Implement actual ML API call
 */
router.post("/suggestions/:id/create-in-ml", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const repo = data_source_1.AppDataSource.getRepository(AdSuggestion_1.AdSuggestion);
        const suggestion = yield repo.findOne({
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
        yield repo.save(suggestion);
        res.json({
            success: true,
            message: "Listing creation queued (implementation pending)",
            suggestion,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
/**
 * Bulk approve suggestions
 */
router.post("/suggestions/bulk-approve", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids)) {
            return res.status(400).json({ error: "ids must be an array" });
        }
        const results = [];
        for (const id of ids) {
            try {
                const suggestion = yield AdSuggestionService_1.adSuggestionService.approveSuggestion(id);
                results.push({ id, success: true });
            }
            catch (e) {
                results.push({ id, success: false, error: e.message });
            }
        }
        res.json({ results });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
// ========== AI Settings Management ==========
const AISettings_1 = require("../entities/AISettings");
/**
 * Get all AI settings
 */
router.get("/settings", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const repo = data_source_1.AppDataSource.getRepository(AISettings_1.AISettings);
        const settings = yield repo.find({ order: { priority: "ASC" } });
        // Mask API keys for security
        const masked = settings.map(s => (Object.assign(Object.assign({}, s), { apiKey: s.apiKey ? "***" + s.apiKey.slice(-4) : null })));
        res.json(masked);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
/**
 * Save AI settings for a provider
 */
router.post("/settings/:provider", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const provider = req.params.provider;
        const { apiKey, model, isEnabled, priority } = req.body;
        if (!["openai", "gemini", "openrouter"].includes(provider)) {
            return res.status(400).json({ error: "Invalid provider" });
        }
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
            message: `${provider} settings saved`
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
/**
 * Delete AI settings for a provider
 */
router.delete("/settings/:provider", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const provider = req.params.provider;
        const repo = data_source_1.AppDataSource.getRepository(AISettings_1.AISettings);
        yield repo.delete({ provider });
        yield reloadOrchestrator();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
/**
 * Test a specific AI provider
 */
router.post("/settings/:provider/test", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const provider = req.params.provider;
        const providerInstance = AgentOrchestrator_1.agentOrchestrator.getProvider(provider);
        if (!providerInstance) {
            return res.json({ success: false, message: `${provider} not configured` });
        }
        const working = yield providerInstance.testConnection();
        res.json({
            success: working,
            message: working ? `${provider} is working!` : `${provider} test failed`
        });
    }
    catch (error) {
        res.json({ success: false, message: error.message });
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
                order: { priority: "ASC" }
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
            console.error("[AI] Failed to reload orchestrator:", e);
        }
    });
}
exports.default = router;
