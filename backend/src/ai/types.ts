/**
 * LLM Provider Interface
 * Base interface for all LLM providers (OpenAI, Gemini, OpenRouter)
 */

export interface LLMMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface LLMResponse {
    content: string;
    model: string;
    provider: string;
    tokensUsed?: number;
}

export interface LLMConfig {
    apiKey: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface ILLMProvider {
    name: string;

    /**
     * Send a chat completion request
     */
    chat(messages: LLMMessage[], config?: Partial<LLMConfig>): Promise<LLMResponse>;

    /**
     * Generate a structured JSON response
     */
    generateJSON<T>(prompt: string, schema?: object): Promise<T>;

    /**
     * Test if the provider is configured and working
     */
    testConnection(): Promise<boolean>;
}

/**
 * Ad Suggestion Types
 */
export type AdSuggestionType =
    | "classico"
    | "premium"
    | "kit_2"
    | "kit_3"
    | "kit_accessory"
    | "seo_variant";

export type AdSuggestionStatus =
    | "pending"
    | "approved"
    | "rejected"
    | "created";

export interface AdSuggestionData {
    type: AdSuggestionType;
    title: string;
    description: string;
    price: number;
    reasoning: string;
    targetNiche?: string;
    stockRequired?: number;
}

export interface ProductAnalysis {
    productId: number;
    originalTitle: string;
    originalPrice: number;
    stock: number;
    suggestions: AdSuggestionData[];
    analysisDate: Date;
}
