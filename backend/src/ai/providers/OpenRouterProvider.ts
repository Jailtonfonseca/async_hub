import axios from "axios";
import { ILLMProvider, LLMMessage, LLMResponse, LLMConfig } from "../types";

/**
 * OpenRouter Provider (access to Claude, Mixtral, Llama, etc.)
 */
export class OpenRouterProvider implements ILLMProvider {
    name = "openrouter";
    private apiKey: string;
    private defaultModel: string;
    private baseUrl = "https://openrouter.ai/api/v1";

    constructor(apiKey: string, model: string = "anthropic/claude-3-haiku") {
        this.apiKey = apiKey;
        this.defaultModel = model;
    }

    async chat(messages: LLMMessage[], config?: Partial<LLMConfig>): Promise<LLMResponse> {
        try {
            const response: any = await axios.post(
                `${this.baseUrl}/chat/completions`,
                {
                    model: config?.model || this.defaultModel,
                    messages: messages,
                    max_tokens: config?.maxTokens || 2000,
                    temperature: config?.temperature || 0.7,
                },
                {
                    headers: {
                        "Authorization": `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://async.torado.store",
                        "X-Title": "ASync Hub",
                    },
                }
            );

            return {
                content: response.data.choices[0].message.content,
                model: response.data.model,
                provider: this.name,
                tokensUsed: response.data.usage?.total_tokens,
            };
        } catch (error: any) {
            console.error("[OpenRouter] Error:", error.response?.data || error.message);
            throw new Error(`OpenRouter error: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    async generateJSON<T>(prompt: string, schema?: object): Promise<T> {
        const systemPrompt = `You are a JSON generator. Respond ONLY with valid JSON, no markdown or explanation.
${schema ? `Follow this schema: ${JSON.stringify(schema)}` : ""}`;

        const response = await this.chat([
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
        ]);

        try {
            let content = response.content.trim();
            if (content.startsWith("```json")) {
                content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
            }
            if (content.startsWith("```")) {
                content = content.replace(/```\n?/g, "");
            }
            return JSON.parse(content) as T;
        } catch (e) {
            console.error("[OpenRouter] Failed to parse JSON:", response.content);
            throw new Error("Failed to parse OpenRouter response as JSON");
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.chat([{ role: "user", content: "Say 'ok'" }], { maxTokens: 10 });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get list of available models
     */
    static availableModels = [
        "anthropic/claude-3-haiku",
        "anthropic/claude-3-sonnet",
        "anthropic/claude-3-opus",
        "mistralai/mixtral-8x7b-instruct",
        "meta-llama/llama-3-70b-instruct",
        "google/gemini-pro",
        "openai/gpt-4-turbo",
    ];
}
