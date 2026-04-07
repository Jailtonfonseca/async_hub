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
exports.agentOrchestrator = exports.AgentOrchestrator = void 0;
const OpenAIProvider_1 = require("./providers/OpenAIProvider");
const GeminiProvider_1 = require("./providers/GeminiProvider");
const OpenRouterProvider_1 = require("./providers/OpenRouterProvider");
/**
 * Agent Orchestrator
 * Manages multiple LLM providers with fallback support
 */
class AgentOrchestrator {
    constructor() {
        this.providers = new Map();
        this.providerPriority = [];
        this.providerPriorities = new Map();
        this.initializeFromEnv();
    }
    /**
     * Initialize providers from environment variables
     */
    initializeFromEnv() {
        if (process.env.OPENAI_API_KEY) {
            this.addProvider({
                name: "openai",
                apiKey: process.env.OPENAI_API_KEY,
                model: process.env.OPENAI_MODEL || "gpt-4o",
                priority: 1,
            });
        }
        if (process.env.GEMINI_API_KEY) {
            this.addProvider({
                name: "gemini",
                apiKey: process.env.GEMINI_API_KEY,
                model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
                priority: 2,
            });
        }
        if (process.env.OPENROUTER_API_KEY) {
            this.addProvider({
                name: "openrouter",
                apiKey: process.env.OPENROUTER_API_KEY,
                model: process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
                priority: 3,
            });
        }
        console.log(`[AgentOrchestrator] Initialized with ${this.providers.size} providers: ${this.providerPriority.join(", ")}`);
    }
    /**
     * Add or update a provider
     */
    addProvider(config) {
        let provider;
        switch (config.name) {
            case "openai":
                provider = new OpenAIProvider_1.OpenAIProvider(config.apiKey, config.model);
                break;
            case "gemini":
                provider = new GeminiProvider_1.GeminiProvider(config.apiKey, config.model);
                break;
            case "openrouter":
                provider = new OpenRouterProvider_1.OpenRouterProvider(config.apiKey, config.model);
                break;
            default:
                throw new Error(`Unknown provider: ${config.name}`);
        }
        this.providers.set(config.name, provider);
        this.providerPriorities.set(config.name, config.priority);
        // Rebuild priority list without duplicates
        this.rebuildPriorityList();
    }
    /**
     * Remove a provider
     */
    removeProvider(name) {
        this.providers.delete(name);
        this.providerPriorities.delete(name);
        this.rebuildPriorityList();
    }
    /**
     * Clear all providers
     */
    clearProviders() {
        this.providers.clear();
        this.providerPriorities.clear();
        this.providerPriority = [];
    }
    /**
     * Rebuild priority list from priorities map
     */
    rebuildPriorityList() {
        this.providerPriority = Array.from(this.providers.keys()).sort((a, b) => {
            return (this.providerPriorities.get(a) || 99) - (this.providerPriorities.get(b) || 99);
        });
    }
    /**
     * Get a specific provider
     */
    getProvider(name) {
        return this.providers.get(name);
    }
    /**
     * Chat with automatic fallback
     */
    chat(messages, preferredProvider) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.providers.size === 0) {
                throw new Error("No LLM providers configured. Please add API keys in Settings > AI Configuration.");
            }
            const order = preferredProvider
                ? [preferredProvider, ...this.providerPriority.filter(p => p !== preferredProvider)]
                : this.providerPriority;
            const errors = [];
            for (const providerName of order) {
                const provider = this.providers.get(providerName);
                if (!provider)
                    continue;
                try {
                    console.log(`[AgentOrchestrator] Trying ${providerName}...`);
                    const response = yield provider.chat(messages);
                    console.log(`[AgentOrchestrator] Success with ${providerName}`);
                    return response;
                }
                catch (error) {
                    console.error(`[AgentOrchestrator] ${providerName} failed: ${error.message}`);
                    errors.push(`${providerName}: ${error.message}`);
                    continue;
                }
            }
            throw new Error(`All LLM providers failed. Errors: ${errors.join("; ")}`);
        });
    }
    /**
     * Generate JSON with automatic fallback
     */
    generateJSON(prompt, schema, preferredProvider) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.providers.size === 0) {
                throw new Error("No LLM providers configured. Please add API keys in Settings > AI Configuration.");
            }
            const order = preferredProvider
                ? [preferredProvider, ...this.providerPriority.filter(p => p !== preferredProvider)]
                : this.providerPriority;
            const errors = [];
            for (const providerName of order) {
                const provider = this.providers.get(providerName);
                if (!provider)
                    continue;
                try {
                    console.log(`[AgentOrchestrator] JSON generation with ${providerName}...`);
                    const result = yield provider.generateJSON(prompt, schema);
                    return result;
                }
                catch (error) {
                    console.error(`[AgentOrchestrator] ${providerName} JSON failed: ${error.message}`);
                    errors.push(`${providerName}: ${error.message}`);
                    continue;
                }
            }
            throw new Error(`All LLM providers failed for JSON generation. Errors: ${errors.join("; ")}`);
        });
    }
    /**
     * Test all providers
     */
    testAllProviders() {
        return __awaiter(this, void 0, void 0, function* () {
            const results = {};
            for (const [name, provider] of this.providers) {
                try {
                    results[name] = yield provider.testConnection();
                }
                catch (_a) {
                    results[name] = false;
                }
            }
            return results;
        });
    }
    /**
     * Get status of all providers
     */
    getStatus() {
        return {
            configuredProviders: Array.from(this.providers.keys()),
            priority: this.providerPriority,
            count: this.providers.size,
            hasProviders: this.providers.size > 0,
        };
    }
}
exports.AgentOrchestrator = AgentOrchestrator;
// Singleton instance
exports.agentOrchestrator = new AgentOrchestrator();
