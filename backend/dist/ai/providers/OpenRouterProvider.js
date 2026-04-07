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
exports.OpenRouterProvider = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * OpenRouter Provider (access to Claude, Mixtral, Llama, etc.)
 */
class OpenRouterProvider {
    constructor(apiKey, model = "anthropic/claude-3-haiku") {
        this.name = "openrouter";
        this.baseUrl = "https://openrouter.ai/api/v1";
        this.apiKey = apiKey;
        this.defaultModel = model;
    }
    chat(messages, config) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            try {
                const response = yield axios_1.default.post(`${this.baseUrl}/chat/completions`, {
                    model: (config === null || config === void 0 ? void 0 : config.model) || this.defaultModel,
                    messages: messages,
                    max_tokens: (config === null || config === void 0 ? void 0 : config.maxTokens) || 2000,
                    temperature: (config === null || config === void 0 ? void 0 : config.temperature) || 0.7,
                }, {
                    headers: {
                        "Authorization": `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://async.torado.store",
                        "X-Title": "ASync Hub",
                    },
                });
                return {
                    content: response.data.choices[0].message.content,
                    model: response.data.model,
                    provider: this.name,
                    tokensUsed: (_a = response.data.usage) === null || _a === void 0 ? void 0 : _a.total_tokens,
                };
            }
            catch (error) {
                console.error("[OpenRouter] Error:", ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message);
                throw new Error(`OpenRouter error: ${((_e = (_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) === null || _e === void 0 ? void 0 : _e.message) || error.message}`);
            }
        });
    }
    generateJSON(prompt, schema) {
        return __awaiter(this, void 0, void 0, function* () {
            const systemPrompt = `You are a JSON generator. Respond ONLY with valid JSON, no markdown or explanation.
${schema ? `Follow this schema: ${JSON.stringify(schema)}` : ""}`;
            const response = yield this.chat([
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
                return JSON.parse(content);
            }
            catch (e) {
                console.error("[OpenRouter] Failed to parse JSON:", response.content);
                throw new Error("Failed to parse OpenRouter response as JSON");
            }
        });
    }
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.chat([{ role: "user", content: "Say 'ok'" }], { maxTokens: 10 });
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
}
exports.OpenRouterProvider = OpenRouterProvider;
/**
 * Get list of available models
 */
OpenRouterProvider.availableModels = [
    "anthropic/claude-3-haiku",
    "anthropic/claude-3-sonnet",
    "anthropic/claude-3-opus",
    "mistralai/mixtral-8x7b-instruct",
    "meta-llama/llama-3-70b-instruct",
    "google/gemini-pro",
    "openai/gpt-4-turbo",
];
