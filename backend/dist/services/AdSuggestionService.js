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
Object.defineProperty(exports, "__esModule", { value: true });
exports.adSuggestionService = exports.AdSuggestionService = void 0;
const data_source_1 = require("../data-source");
const Product_1 = require("../entities/Product");
const AdSuggestion_1 = require("../entities/AdSuggestion");
const AgentOrchestrator_1 = require("../ai/AgentOrchestrator");
// ML fee rates
const ML_TAXA_CLASSICO = 0.11;
const ML_TAXA_PREMIUM = 0.16;
const ML_TAXA_FIXA_PREMIUM = 5;
/**
 * Ad Suggestion Service
 * Generates and manages AI-powered ad suggestions
 */
class AdSuggestionService {
    /**
     * Generate suggestions for a product
     */
    generateSuggestions(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const productRepo = data_source_1.AppDataSource.getRepository(Product_1.Product);
            const suggestionRepo = data_source_1.AppDataSource.getRepository(AdSuggestion_1.AdSuggestion);
            const product = yield productRepo.findOneBy({ id: productId });
            if (!product) {
                throw new Error("Product not found");
            }
            console.log(`[AdSuggestionService] Generating suggestions for: ${product.title}`);
            const suggestions = [];
            // 1. Calculate Clássico price
            const classicoSuggestion = this.createClassicoSuggestion(product);
            suggestions.push(classicoSuggestion);
            // 2. Calculate Premium price
            const premiumSuggestion = this.createPremiumSuggestion(product);
            suggestions.push(premiumSuggestion);
            // 3. Kit suggestions (only if stock >= 4)
            if (product.stock >= 4) {
                const kit2 = this.createKitSuggestion(product, 2);
                suggestions.push(kit2);
            }
            if (product.stock >= 6) {
                const kit3 = this.createKitSuggestion(product, 3);
                suggestions.push(kit3);
            }
            // 4. SEO variants via AI
            try {
                const seoVariants = yield this.generateSEOVariants(product);
                suggestions.push(...seoVariants);
            }
            catch (e) {
                console.error(`[AdSuggestionService] SEO generation failed: ${e.message}`);
            }
            // Save all suggestions
            for (const suggestion of suggestions) {
                suggestion.productId = productId;
                yield suggestionRepo.save(suggestion);
            }
            console.log(`[AdSuggestionService] Generated ${suggestions.length} suggestions`);
            return suggestions;
        });
    }
    /**
     * Create Clássico suggestion
     */
    createClassicoSuggestion(product) {
        const suggestion = new AdSuggestion_1.AdSuggestion();
        suggestion.type = "classico";
        suggestion.suggestedTitle = product.title;
        suggestion.suggestedDescription = product.description;
        suggestion.suggestedPrice = Number(product.price);
        suggestion.stockRequired = 1;
        suggestion.reasoning = "Anúncio Clássico: taxa menor (11%), parcelamento com juros. Ideal para clientes que pagam à vista (Pix/Boleto).";
        suggestion.status = "pending";
        return suggestion;
    }
    /**
     * Create Premium suggestion with adjusted price
     */
    createPremiumSuggestion(product) {
        const basePrice = Number(product.price);
        // Calculate price to maintain same profit margin
        // Premium has higher fee, so price must be higher
        const priceDiff = (basePrice * (ML_TAXA_PREMIUM - ML_TAXA_CLASSICO)) + ML_TAXA_FIXA_PREMIUM;
        const premiumPrice = Math.ceil(basePrice + priceDiff);
        const suggestion = new AdSuggestion_1.AdSuggestion();
        suggestion.type = "premium";
        suggestion.suggestedTitle = product.title;
        suggestion.suggestedDescription = product.description;
        suggestion.suggestedPrice = premiumPrice;
        suggestion.stockRequired = 1;
        suggestion.reasoning = `Anúncio Premium: preço R$ ${premiumPrice} cobre taxa extra (16% + R$5). Oferece 12x sem juros. Atrai clientes que precisam parcelar.`;
        suggestion.status = "pending";
        return suggestion;
    }
    /**
     * Create Kit suggestion
     */
    createKitSuggestion(product, quantity) {
        const basePrice = Number(product.price);
        const discountPercent = quantity === 2 ? 0.08 : 0.12; // 8% for 2, 12% for 3
        const kitPrice = Math.ceil(basePrice * quantity * (1 - discountPercent));
        const suggestion = new AdSuggestion_1.AdSuggestion();
        suggestion.type = quantity === 2 ? "kit_2" : "kit_3";
        suggestion.suggestedTitle = `Kit ${quantity} ${product.title}`;
        suggestion.suggestedDescription = `Kit com ${quantity} unidades. ${product.description || ""}`;
        suggestion.suggestedPrice = kitPrice;
        suggestion.stockRequired = quantity;
        suggestion.reasoning = `Kit ${quantity} unidades com ${Math.round(discountPercent * 100)}% de desconto. Aumenta ticket médio. Estoque atual: ${product.stock} (suficiente).`;
        suggestion.status = "pending";
        return suggestion;
    }
    /**
     * Generate SEO variant titles via AI
     */
    generateSEOVariants(product) {
        return __awaiter(this, void 0, void 0, function* () {
            const prompt = `
Você é um especialista em SEO do Mercado Livre.

Analise este produto:
- Título atual: "${product.title}"
- Descrição: "${product.description || 'N/A'}"
- Categoria: "${product.category || 'N/A'}"
- Preço: R$ ${product.price}

Identifique 2-3 NICHOS DIFERENTES de compradores e crie títulos otimizados para cada um.
Cada título deve ter no máximo 60 caracteres.
Os títulos devem usar palavras-chave diferentes para ranquear em buscas diferentes.

Responda em JSON:
{
  "variants": [
    {
      "niche": "nome do nicho",
      "title": "título otimizado",
      "reasoning": "por que esse título atrai esse público"
    }
  ]
}`;
            const result = yield AgentOrchestrator_1.agentOrchestrator.generateJSON(prompt);
            if (!result.variants || !Array.isArray(result.variants)) {
                return [];
            }
            return result.variants.map((v, index) => {
                const suggestion = new AdSuggestion_1.AdSuggestion();
                suggestion.type = "seo_variant";
                suggestion.suggestedTitle = v.title.substring(0, 60);
                suggestion.suggestedDescription = product.description;
                suggestion.suggestedPrice = Number(product.price);
                suggestion.stockRequired = 1;
                suggestion.targetNiche = v.niche;
                suggestion.reasoning = `SEO para nicho "${v.niche}": ${v.reasoning}`;
                suggestion.generatedBy = AgentOrchestrator_1.agentOrchestrator.getStatus().configuredProviders[0] || "ai";
                suggestion.status = "pending";
                return suggestion;
            });
        });
    }
    /**
     * Approve a suggestion
     */
    approveSuggestion(suggestionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = data_source_1.AppDataSource.getRepository(AdSuggestion_1.AdSuggestion);
            const suggestion = yield repo.findOneBy({ id: suggestionId });
            if (!suggestion) {
                throw new Error("Suggestion not found");
            }
            suggestion.status = "approved";
            suggestion.approvedAt = new Date();
            yield repo.save(suggestion);
            return suggestion;
        });
    }
    /**
     * Reject a suggestion
     */
    rejectSuggestion(suggestionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = data_source_1.AppDataSource.getRepository(AdSuggestion_1.AdSuggestion);
            const suggestion = yield repo.findOneBy({ id: suggestionId });
            if (!suggestion) {
                throw new Error("Suggestion not found");
            }
            suggestion.status = "rejected";
            yield repo.save(suggestion);
            return suggestion;
        });
    }
    /**
     * Get pending suggestions
     */
    getPendingSuggestions() {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = data_source_1.AppDataSource.getRepository(AdSuggestion_1.AdSuggestion);
            return repo.find({
                where: { status: "pending" },
                relations: ["product"],
                order: { createdAt: "DESC" },
            });
        });
    }
    /**
     * Get suggestions by product
     */
    getSuggestionsByProduct(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = data_source_1.AppDataSource.getRepository(AdSuggestion_1.AdSuggestion);
            return repo.find({
                where: { productId },
                order: { createdAt: "DESC" },
            });
        });
    }
}
exports.AdSuggestionService = AdSuggestionService;
exports.adSuggestionService = new AdSuggestionService();
