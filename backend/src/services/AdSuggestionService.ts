import { AppDataSource } from "../data-source";
import { Product } from "../entities/Product";
import { AdSuggestion, AdSuggestionType, AdSuggestionStatus } from "../entities/AdSuggestion";
import { agentOrchestrator } from "../ai/AgentOrchestrator";
import { AdSuggestionData } from "../ai/types";

// ML fee rates
const ML_TAXA_CLASSICO = 0.11;
const ML_TAXA_PREMIUM = 0.16;
const ML_TAXA_FIXA_PREMIUM = 5;

/**
 * Ad Suggestion Service
 * Generates and manages AI-powered ad suggestions
 */
export class AdSuggestionService {

    /**
     * Generate suggestions for a product
     */
    async generateSuggestions(productId: number): Promise<AdSuggestion[]> {
        const productRepo = AppDataSource.getRepository(Product);
        const suggestionRepo = AppDataSource.getRepository(AdSuggestion);

        const product = await productRepo.findOneBy({ id: productId });
        if (!product) {
            throw new Error("Product not found");
        }

        console.log(`[AdSuggestionService] Generating suggestions for: ${product.title}`);

        const suggestions: AdSuggestion[] = [];

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
            const seoVariants = await this.generateSEOVariants(product);
            suggestions.push(...seoVariants);
        } catch (e: any) {
            console.error(`[AdSuggestionService] SEO generation failed: ${e.message}`);
        }

        // Save all suggestions
        for (const suggestion of suggestions) {
            suggestion.productId = productId;
            await suggestionRepo.save(suggestion);
        }

        console.log(`[AdSuggestionService] Generated ${suggestions.length} suggestions`);
        return suggestions;
    }

    /**
     * Create Clássico suggestion
     */
    private createClassicoSuggestion(product: Product): AdSuggestion {
        const suggestion = new AdSuggestion();
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
    private createPremiumSuggestion(product: Product): AdSuggestion {
        const basePrice = Number(product.price);

        // Calculate price to maintain same profit margin
        // Premium has higher fee, so price must be higher
        const priceDiff = (basePrice * (ML_TAXA_PREMIUM - ML_TAXA_CLASSICO)) + ML_TAXA_FIXA_PREMIUM;
        const premiumPrice = Math.ceil(basePrice + priceDiff);

        const suggestion = new AdSuggestion();
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
    private createKitSuggestion(product: Product, quantity: number): AdSuggestion {
        const basePrice = Number(product.price);
        const discountPercent = quantity === 2 ? 0.08 : 0.12; // 8% for 2, 12% for 3
        const kitPrice = Math.ceil(basePrice * quantity * (1 - discountPercent));

        const suggestion = new AdSuggestion();
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
    private async generateSEOVariants(product: Product): Promise<AdSuggestion[]> {
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

        interface SEOResponse {
            variants: Array<{
                niche: string;
                title: string;
                reasoning: string;
            }>;
        }

        const result = await agentOrchestrator.generateJSON<SEOResponse>(prompt);

        if (!result.variants || !Array.isArray(result.variants)) {
            return [];
        }

        return result.variants.map((v, index) => {
            const suggestion = new AdSuggestion();
            suggestion.type = "seo_variant";
            suggestion.suggestedTitle = v.title.substring(0, 60);
            suggestion.suggestedDescription = product.description;
            suggestion.suggestedPrice = Number(product.price);
            suggestion.stockRequired = 1;
            suggestion.targetNiche = v.niche;
            suggestion.reasoning = `SEO para nicho "${v.niche}": ${v.reasoning}`;
            suggestion.generatedBy = agentOrchestrator.getStatus().configuredProviders[0] || "ai";
            suggestion.status = "pending";
            return suggestion;
        });
    }

    /**
     * Approve a suggestion
     */
    async approveSuggestion(suggestionId: number): Promise<AdSuggestion> {
        const repo = AppDataSource.getRepository(AdSuggestion);
        const suggestion = await repo.findOneBy({ id: suggestionId });

        if (!suggestion) {
            throw new Error("Suggestion not found");
        }

        suggestion.status = "approved";
        suggestion.approvedAt = new Date();
        await repo.save(suggestion);

        return suggestion;
    }

    /**
     * Reject a suggestion
     */
    async rejectSuggestion(suggestionId: number): Promise<AdSuggestion> {
        const repo = AppDataSource.getRepository(AdSuggestion);
        const suggestion = await repo.findOneBy({ id: suggestionId });

        if (!suggestion) {
            throw new Error("Suggestion not found");
        }

        suggestion.status = "rejected";
        await repo.save(suggestion);

        return suggestion;
    }

    /**
     * Get pending suggestions
     */
    async getPendingSuggestions(): Promise<AdSuggestion[]> {
        const repo = AppDataSource.getRepository(AdSuggestion);
        return repo.find({
            where: { status: "pending" as AdSuggestionStatus },
            relations: ["product"],
            order: { createdAt: "DESC" },
        });
    }

    /**
     * Get suggestions by product
     */
    async getSuggestionsByProduct(productId: number): Promise<AdSuggestion[]> {
        const repo = AppDataSource.getRepository(AdSuggestion);
        return repo.find({
            where: { productId },
            order: { createdAt: "DESC" },
        });
    }
}

export const adSuggestionService = new AdSuggestionService();
