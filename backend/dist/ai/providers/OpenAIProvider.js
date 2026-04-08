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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * OpenAI Provider
 * Supports all models: GPT-4o, GPT-4.5, o1, o3, etc.
 * Uses Chat Completions API (compatible with all models)
 */
class OpenAIProvider {
    constructor(apiKey, model = "gpt-4o") {
        this.name = "openai";
        this.baseUrl = "https://api.openai.com/v1";
        this.apiKey = apiKey;
        this.defaultModel = model;
    }
    chat(messages, config) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const model = (config === null || config === void 0 ? void 0 : config.model) || this.defaultModel;
            try {
                // Check if model is a reasoning model (o1, o3) that might need Responses API
                const isReasoningModel = model.startsWith("o1") || model.startsWith("o3");
                if (isReasoningModel) {
                    return yield this.chatWithResponsesAPI(messages, model, config);
                }
                else {
                    return yield this.chatWithCompletionsAPI(messages, model, config);
                }
            }
            catch (error) {
                // Fallback: if Responses API fails, try Completions API
                if (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 404) {
                    console.log(`[OpenAI] Model ${model} not found in Responses API, trying Completions API...`);
                    return yield this.chatWithCompletionsAPI(messages, model, config);
                }
                console.error("[OpenAI] Error:", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
                throw new Error(`OpenAI error: ${((_e = (_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) === null || _e === void 0 ? void 0 : _e.message) || error.message}`);
            }
        });
    }
    /**
     * Chat Completions API (works with GPT-4, GPT-4o, GPT-4.5, etc.)
     */
    chatWithCompletionsAPI(messages, model, config) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const response = yield axios_1.default.post(`${this.baseUrl}/chat/completions`, {
                model,
                messages,
                max_tokens: (config === null || config === void 0 ? void 0 : config.maxTokens) || 4096,
                temperature: (config === null || config === void 0 ? void 0 : config.temperature) || 0.7,
            }, {
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                timeout: 120000, // 2 min timeout for long responses
            });
            return {
                content: response.data.choices[0].message.content,
                model: response.data.model,
                provider: this.name,
                tokensUsed: (_a = response.data.usage) === null || _a === void 0 ? void 0 : _a.total_tokens,
            };
        });
    }
    /**
     * Responses API (for o1, o3 reasoning models)
     * New API format introduced in 2025
     */
    chatWithResponsesAPI(messages, model, config) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Convert messages to Responses API format
            const formattedMessages = messages.map(m => ({
                role: m.role,
                content: m.content,
            }));
            const response = yield axios_1.default.post(`${this.baseUrl}/responses`, {
                model,
                input: formattedMessages,
                max_output_tokens: (config === null || config === void 0 ? void 0 : config.maxTokens) || 4096,
            }, {
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                timeout: 180000, // 3 min timeout for reasoning models
            });
            // Parse response from Responses API format
            const output = response.data.output || [];
            const textContent = output
                .filter((item) => item.type === "message")
                .map((item) => { var _a; return ((_a = item.content) === null || _a === void 0 ? void 0 : _a.map((c) => c.text).join("")) || ""; })
                .join("");
            return {
                content: textContent || response.data.output_text || "",
                model: response.data.model || model,
                provider: this.name,
                tokensUsed: (_a = response.data.usage) === null || _a === void 0 ? void 0 : _a.total_tokens,
            };
        });
    }
    generateJSON(prompt, schema) {
        return __awaiter(this, void 0, void 0, function* () {
            const systemPrompt = `You are a JSON generator. Always respond with valid JSON only, no markdown or explanation.
${schema ? `Follow this schema: ${JSON.stringify(schema)}` : ""}`;
            const response = yield this.chat([
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
                return JSON.parse(content);
            }
            catch (e) {
                console.error("[OpenAI] Failed to parse JSON:", response.content);
                throw new Error("Failed to parse LLM response as JSON");
            }
        });
    }
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Use a simple test that works with any model
                yield this.chat([{ role: "user", content: "Say 'ok'" }], { maxTokens: 10 });
                return true;
            }
            catch (e) {
                console.error("[OpenAI] Test failed:", e.message);
                return false;
            }
        });
    }
}
exports.OpenAIProvider = OpenAIProvider;
