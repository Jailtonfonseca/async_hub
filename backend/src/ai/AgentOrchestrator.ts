import { ILLMProvider, LLMMessage, LLMResponse } from "./types";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import { GeminiProvider } from "./providers/GeminiProvider";
import { OpenRouterProvider } from "./providers/OpenRouterProvider";

type ProviderName = "openai" | "gemini" | "openrouter";

interface ProviderConfig {
    name: ProviderName;
    apiKey: string;
    model?: string;
    priority: number;
}

/**
 * Agent Orchestrator
 * Manages multiple LLM providers with fallback support
 */
export class AgentOrchestrator {
    private providers: Map<ProviderName, ILLMProvider> = new Map();
    private providerPriority: ProviderName[] = [];

    constructor() {
        this.initializeFromEnv();
    }

    /**
     * Initialize providers from environment variables
     */
    private initializeFromEnv() {
        if (process.env.OPENAI_API_KEY) {
            this.addProvider({
                name: "openai",
                apiKey: process.env.OPENAI_API_KEY,
                model: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
                priority: 1,
            });
        }

        if (process.env.GEMINI_API_KEY) {
            this.addProvider({
                name: "gemini",
                apiKey: process.env.GEMINI_API_KEY,
                model: process.env.GEMINI_MODEL || "gemini-pro",
                priority: 2,
            });
        }

        if (process.env.OPENROUTER_API_KEY) {
            this.addProvider({
                name: "openrouter",
                apiKey: process.env.OPENROUTER_API_KEY,
                model: process.env.OPENROUTER_MODEL || "anthropic/claude-3-haiku",
                priority: 3,
            });
        }

        console.log(`[AgentOrchestrator] Initialized with ${this.providers.size} providers: ${this.providerPriority.join(", ")}`);
    }

    /**
     * Add a provider
     */
    addProvider(config: ProviderConfig) {
        let provider: ILLMProvider;

        switch (config.name) {
            case "openai":
                provider = new OpenAIProvider(config.apiKey, config.model);
                break;
            case "gemini":
                provider = new GeminiProvider(config.apiKey, config.model);
                break;
            case "openrouter":
                provider = new OpenRouterProvider(config.apiKey, config.model);
                break;
            default:
                throw new Error(`Unknown provider: ${config.name}`);
        }

        this.providers.set(config.name, provider);
        this.providerPriority.push(config.name);
        this.providerPriority.sort((a, b) => {
            const priorities: Record<ProviderName, number> = { openai: 1, gemini: 2, openrouter: 3 };
            return priorities[a] - priorities[b];
        });
    }

    /**
     * Get a specific provider
     */
    getProvider(name: ProviderName): ILLMProvider | undefined {
        return this.providers.get(name);
    }

    /**
     * Chat with automatic fallback
     */
    async chat(messages: LLMMessage[], preferredProvider?: ProviderName): Promise<LLMResponse> {
        const order = preferredProvider
            ? [preferredProvider, ...this.providerPriority.filter(p => p !== preferredProvider)]
            : this.providerPriority;

        for (const providerName of order) {
            const provider = this.providers.get(providerName);
            if (!provider) continue;

            try {
                console.log(`[AgentOrchestrator] Trying ${providerName}...`);
                const response = await provider.chat(messages);
                console.log(`[AgentOrchestrator] Success with ${providerName}`);
                return response;
            } catch (error: any) {
                console.error(`[AgentOrchestrator] ${providerName} failed: ${error.message}`);
                continue;
            }
        }

        throw new Error("All LLM providers failed");
    }

    /**
     * Generate JSON with automatic fallback
     */
    async generateJSON<T>(prompt: string, schema?: object, preferredProvider?: ProviderName): Promise<T> {
        const order = preferredProvider
            ? [preferredProvider, ...this.providerPriority.filter(p => p !== preferredProvider)]
            : this.providerPriority;

        for (const providerName of order) {
            const provider = this.providers.get(providerName);
            if (!provider) continue;

            try {
                console.log(`[AgentOrchestrator] JSON generation with ${providerName}...`);
                const result = await provider.generateJSON<T>(prompt, schema);
                return result;
            } catch (error: any) {
                console.error(`[AgentOrchestrator] ${providerName} JSON failed: ${error.message}`);
                continue;
            }
        }

        throw new Error("All LLM providers failed for JSON generation");
    }

    /**
     * Test all providers
     */
    async testAllProviders(): Promise<Record<ProviderName, boolean>> {
        const results: Record<string, boolean> = {};

        for (const [name, provider] of this.providers) {
            results[name] = await provider.testConnection();
        }

        return results as Record<ProviderName, boolean>;
    }

    /**
     * Get status of all providers
     */
    getStatus() {
        return {
            configuredProviders: Array.from(this.providers.keys()),
            priority: this.providerPriority,
            count: this.providers.size,
        };
    }
}

// Singleton instance
export const agentOrchestrator = new AgentOrchestrator();
