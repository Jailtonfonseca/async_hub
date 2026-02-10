import axios from "axios";
import { ILLMProvider, LLMMessage, LLMResponse, LLMConfig } from "../types";

/**
 * Google Gemini Provider
 */
export class GeminiProvider implements ILLMProvider {
    name = "gemini";
    private apiKey: string;
    private defaultModel: string;
    private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

    constructor(apiKey: string, model: string = "gemini-pro") {
        this.apiKey = apiKey;
        this.defaultModel = model;
    }

    async chat(messages: LLMMessage[], config?: Partial<LLMConfig>): Promise<LLMResponse> {
        try {
            const model = config?.model || this.defaultModel;

            // Convert messages to Gemini format
            const contents = messages
                .filter(m => m.role !== "system")
                .map(m => ({
                    role: m.role === "assistant" ? "model" : "user",
                    parts: [{ text: m.content }],
                }));

            // Add system as first user message if exists
            const systemMsg = messages.find(m => m.role === "system");
            if (systemMsg && contents.length > 0) {
                contents[0].parts[0].text = `${systemMsg.content}\n\n${contents[0].parts[0].text}`;
            }

            const response: any = await axios.post(
                `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
                {
                    contents,
                    generationConfig: {
                        maxOutputTokens: config?.maxTokens || 2000,
                        temperature: config?.temperature || 0.7,
                    },
                },
                {
                    headers: { "Content-Type": "application/json" },
                }
            );

            const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            return {
                content: text,
                model: model,
                provider: this.name,
            };
        } catch (error: any) {
            console.error("[Gemini] Error:", error.response?.data || error.message);
            throw new Error(`Gemini error: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    async generateJSON<T>(prompt: string, schema?: object): Promise<T> {
        const fullPrompt = `Responda APENAS com JSON válido, sem explicações.
${schema ? `Siga este schema: ${JSON.stringify(schema)}` : ""}

${prompt}`;

        const response = await this.chat([{ role: "user", content: fullPrompt }]);

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
            console.error("[Gemini] Failed to parse JSON:", response.content);
            throw new Error("Failed to parse Gemini response as JSON");
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.chat([{ role: "user", content: "Responda: ok" }], { maxTokens: 10 });
            return true;
        } catch {
            return false;
        }
    }
}
