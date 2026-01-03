import axios from "axios";
import { ILLMProvider, LLMMessage, LLMResponse, LLMConfig } from "../types";

/**
 * OpenAI Provider (GPT-4, GPT-3.5-turbo)
 */
export class OpenAIProvider implements ILLMProvider {
    name = "openai";
    private apiKey: string;
    private defaultModel: string;
    private baseUrl = "https://api.openai.com/v1";

    constructor(apiKey: string, model: string = "gpt-4-turbo-preview") {
        this.apiKey = apiKey;
        this.defaultModel = model;
    }

    async chat(messages: LLMMessage[], config?: Partial<LLMConfig>): Promise<LLMResponse> {
        try {
            const response = await axios.post(
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
            console.error("[OpenAI] Error:", error.response?.data || error.message);
            throw new Error(`OpenAI error: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    async generateJSON<T>(prompt: string, schema?: object): Promise<T> {
        const systemPrompt = `You are a JSON generator. Always respond with valid JSON only, no markdown or explanation.
${schema ? `Follow this schema: ${JSON.stringify(schema)}` : ""}`;

        const response = await this.chat([
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
        ]);

        try {
            // Clean response if wrapped in markdown
            let content = response.content.trim();
            if (content.startsWith("```json")) {
                content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
            }
            return JSON.parse(content) as T;
        } catch (e) {
            console.error("[OpenAI] Failed to parse JSON:", response.content);
            throw new Error("Failed to parse LLM response as JSON");
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
}
