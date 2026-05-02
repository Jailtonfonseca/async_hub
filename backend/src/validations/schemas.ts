import { z } from "zod";

// Connection schemas
export const woocommerceConnectionSchema = z.object({
    apiUrl: z.string().url("URL inválida").min(1, "URL é obrigatória"),
    apiKey: z.string().min(10, "API Key deve ter pelo menos 10 caracteres"),
    apiSecret: z.string().min(10, "API Secret deve ter pelo menos 10 caracteres"),
});

export const mercadolibreConnectionSchema = z.object({
    apiKey: z.string().min(10, "App ID deve ter pelo menos 10 caracteres"),
    apiSecret: z.string().min(10, "Secret deve ter pelo menos 10 caracteres"),
});

export const amazonConnectionSchema = z.object({
    apiUrl: z.string().min(1, "Region é obrigatória"),
    apiKey: z.string().min(10, "Client ID deve ter pelo menos 10 caracteres"),
    apiSecret: z.string().min(10, "Client Secret deve ter pelo menos 10 caracteres"),
    accessToken: z.string().min(10, "Access Key deve ter pelo menos 10 caracteres"),
    userId: z.string().min(10, "Secret Key deve ter pelo menos 10 caracteres"),
    refreshToken: z.string().optional(),
});

// Product schemas
export const shopeeConnectionSchema = z.object({
    apiKey: z.string().min(1, "Partner ID é obrigatório").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Partner ID deve ser um número"),
    apiSecret: z.string().min(10, "Partner Key deve ter pelo menos 10 caracteres"),
});

export const productSyncSchema = z.object({
    marketplace: z.enum(["woocommerce", "mercadolibre", "amazon", "shopee"]).optional(),
});

export const productUpdateSchema = z.object({
    title: z.string().min(1).optional(),
    price: z.number().positive().optional(),
    cost: z.number().min(0).optional(),
    stock: z.number().int().min(0).optional(),
    status: z.enum(["active", "inactive", "draft"]).optional(),
});

// Webhook schemas
export const mercadolibreWebhookSchema = z.object({
    resource: z.string(),
    user_id: z.number(),
    topic: z.string(),
    application_id: z.number(),
    attempted: z.number(),
    sent: z.string(),
});

// AI Suggestion schema
export const aiSuggestionSchema = z.object({
    productId: z.string().uuid().optional(),
    marketplace: z.enum(["woocommerce", "mercadolibre", "amazon", "shopee"]).optional(),
    prompt: z.string().max(1000).optional(),
});

// Settings schema
export const settingsSchema = z.object({
    syncInterval: z.number().int().min(5).max(1440).optional(),
    aiProvider: z.enum(["openai", "gemini", "openrouter"]).optional(),
    aiApiKey: z.string().min(10).optional(),
    aiModel: z.string().optional(),
});

// Generic ID parameter validation
export const idParamSchema = z.object({
    id: z.string().uuid("ID inválido"),
});

export const marketplaceParamSchema = z.object({
    marketplace: z.enum(["woocommerce", "mercadolibre", "amazon", "shopee"]),
});

// Type inference exports
export type WoocommerceConnectionInput = z.infer<typeof woocommerceConnectionSchema>;
export type MercadolivreConnectionInput = z.infer<typeof mercadolibreConnectionSchema>;
export type AmazonConnectionInput = z.infer<typeof amazonConnectionSchema>;
export type ShopeeConnectionInput = z.infer<typeof shopeeConnectionSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type AISuggestionInput = z.infer<typeof aiSuggestionSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
