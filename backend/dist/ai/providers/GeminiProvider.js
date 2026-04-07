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
exports.GeminiProvider = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Google Gemini Provider
 */
class GeminiProvider {
    constructor(apiKey, model = "gemini-pro") {
        this.name = "gemini";
        this.baseUrl = "https://generativelanguage.googleapis.com/v1beta";
        this.apiKey = apiKey;
        this.defaultModel = model;
    }
    chat(messages, config) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            try {
                const model = (config === null || config === void 0 ? void 0 : config.model) || this.defaultModel;
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
                const response = yield axios_1.default.post(`${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`, {
                    contents,
                    generationConfig: {
                        maxOutputTokens: (config === null || config === void 0 ? void 0 : config.maxTokens) || 2000,
                        temperature: (config === null || config === void 0 ? void 0 : config.temperature) || 0.7,
                    },
                }, {
                    headers: { "Content-Type": "application/json" },
                });
                const text = ((_e = (_d = (_c = (_b = (_a = response.data.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text) || "";
                return {
                    content: text,
                    model: model,
                    provider: this.name,
                };
            }
            catch (error) {
                console.error("[Gemini] Error:", ((_f = error.response) === null || _f === void 0 ? void 0 : _f.data) || error.message);
                throw new Error(`Gemini error: ${((_j = (_h = (_g = error.response) === null || _g === void 0 ? void 0 : _g.data) === null || _h === void 0 ? void 0 : _h.error) === null || _j === void 0 ? void 0 : _j.message) || error.message}`);
            }
        });
    }
    generateJSON(prompt, schema) {
        return __awaiter(this, void 0, void 0, function* () {
            const fullPrompt = `Responda APENAS com JSON válido, sem explicações.
${schema ? `Siga este schema: ${JSON.stringify(schema)}` : ""}

${prompt}`;
            const response = yield this.chat([{ role: "user", content: fullPrompt }]);
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
                console.error("[Gemini] Failed to parse JSON:", response.content);
                throw new Error("Failed to parse Gemini response as JSON");
            }
        });
    }
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.chat([{ role: "user", content: "Responda: ok" }], { maxTokens: 10 });
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
}
exports.GeminiProvider = GeminiProvider;
