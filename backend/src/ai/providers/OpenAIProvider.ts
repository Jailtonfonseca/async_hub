import axios from "axios";
import { ILLMProvider, LLMMessage, LLMResponse, LLMConfig } from "../types";

/**
 * OpenAI Provider
 * Supports all models: GPT-4o, GPT-4.5, o1, o3, etc.
 * Uses Chat Completions API (compatible with all models)
 */
export class OpenAIProvider implements ILLMProvider {
    name = "openai";
    private apiKey: string;
    private defaultModel: string;
    private baseUrl = "https://api.openai.com/v1";

    constructor(apiKey: string, model: string = "gpt-4o") {
        this.apiKey = apiKey;
        this.defaultModel = model;
    }

    async chat(messages: LLMMessage[], config?: Partial<LLMConfig>): Promise<LLMResponse> {
        const model = config?.model || this.defaultModel;

        try {
            // Check if model is a reasoning model (o1, o3) that might need Responses API
            const isReasoningModel = model.startsWith("o1") || model.startsWith("o3");

            if (isReasoningModel) {
                return await this.chatWithResponsesAPI(messages, model, config);
            } else {
                return await this.chatWithCompletionsAPI(messages, model, config);
            }
        } catch (error: any) {
            // Fallback: if Responses API fails, try Completions API
            if (error.response?.status === 404) {
                console.log(`[OpenAI] Model ${model} not found in Responses API, trying Completions API...`);
                return await this.chatWithCompletionsAPI(messages, model, config);
            }
            console.error("[OpenAI] Error:", error.response?.data || error.message);
            throw new Error(`OpenAI error: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Chat Completions API (works with GPT-4, GPT-4o, GPT-4.5, etc.)
     */
    private async chatWithCompletionsAPI(
        messages: LLMMessage[],
        model: string,
        config?: Partial<LLMConfig>
    ): Promise<LLMResponse> {
        const response: any = await axios.post(
            `${this.baseUrl}/chat/completions`,
            {
                model,
                messages,
                max_tokens: config?.maxTokens || 4096,
                temperature: config?.temperature || 0.7,
            },
            {
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                timeout: 120000, // 2 min timeout for long responses
            }
        );

        return {
            content: response.data.choices[0].message.content,
            model: response.data.model,
            provider: this.name,
            tokensUsed: response.data.usage?.total_tokens,
        };
    }

    /**
     * Responses API (for o1, o3 reasoning models)
     * New API format introduced in 2025
     */
    private async chatWithResponsesAPI(
        messages: LLMMessage[],
        model: string,
        config?: Partial<LLMConfig>
    ): Promise<LLMResponse> {
        // Convert messages to Responses API format
        const formattedMessages = messages.map(m => ({
            role: m.role,
            content: m.content,
        }));

        const response: any = await axios.post(
            `${this.baseUrl}/responses`,
            {
                model,
                input: formattedMessages,
                max_output_tokens: config?.maxTokens || 4096,
            },
            {
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                timeout: 180000, // 3 min timeout for reasoning models
            }
        );

        // Parse response from Responses API format
        const output = response.data.output || [];
        const textContent = output
            .filter((item: any) => item.type === "message")
            .map((item: any) => item.content?.map((c: any) => c.text).join("") || "")
            .join("");

        return {
            content: textContent || response.data.output_text || "",
            model: response.data.model || model,
            provider: this.name,
            tokensUsed: response.data.usage?.total_tokens,
        };
    }

    async generateJSON<T>(prompt: string, schema?: object): Promise<T> {
        const systemPrompt = `You are a JSON generator. Always respond with valid JSON only, no markdown or explanation.
${schema ? `Follow this schema: ${JSON.stringify(schema)}` : ""}`;

        const response = await this.chat([
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
        ]);

        try {
            let content = response.content.trim();
            // Clean response if wrapped in markdown
            if (content.startsWith("```json")) {
                content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "");
            }
            if (content.startsWith("```")) {
                content = content.replace(/```\n?/g, "");
            }
            return JSON.parse(content) as T;
        } catch (e) {
            console.error("[OpenAI] Failed to parse JSON:", response.content);
            throw new Error("Failed to parse LLM response as JSON");
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            // Use a simple test that works with any model
            await this.chat([{ role: "user", content: "Say 'ok'" }], { maxTokens: 10 });
            return true;
        } catch (e: any) {
            console.error("[OpenAI] Test failed:", e.message);
            return false;
        }
    }
}
