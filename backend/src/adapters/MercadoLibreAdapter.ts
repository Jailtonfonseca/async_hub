import axios, { AxiosInstance } from "axios";
import { IMarketplace, IProduct, IConnectionCredentials } from "../interfaces/IMarketplace";

export class MercadoLibreAdapter implements IMarketplace {
    name = "mercadolibre";
    private client: AxiosInstance;
    private credentials: IConnectionCredentials;
    private userId: string;

    constructor(credentials: IConnectionCredentials) {
        this.credentials = credentials;
        this.userId = credentials.userId || "";
        this.client = axios.create({
            baseURL: "https://api.mercadolibre.com",
            headers: {
                Authorization: `Bearer ${credentials.accessToken}`,
                "Content-Type": "application/json",
            },
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            const response = await this.client.get("/users/me");
            return response.status === 200;
        } catch {
            return false;
        }
    }

    async getProducts(limit = 50, offset = 0): Promise<IProduct[]> {
        const searchResponse = await this.client.get(`/users/${this.userId}/items/search`, {
            params: { limit, offset },
        });

        const itemIds = searchResponse.data.results || [];
        if (itemIds.length === 0) return [];

        const idsParam = itemIds.join(",");
        const itemsResponse = await this.client.get(`/items`, {
            params: { ids: idsParam },
        });

        return itemsResponse.data
            .filter((item: any) => {
                if (item.code !== 200) {
                    console.warn(`[ML Adapter] Failed to fetch item details: ${item.code}`);
                    return false;
                }
                return true;
            })
            .map((item: any) => this.mapToProduct(item.body));
    }

    async getProduct(externalId: string): Promise<IProduct | null> {
        try {
            const response = await this.client.get(`/items/${externalId}`);
            return this.mapToProduct(response.data);
        } catch {
            return null;
        }
    }

    async createProduct(product: IProduct): Promise<IProduct> {
        const mlProduct = this.mapToMLProduct(product);
        const response = await this.client.post("/items", mlProduct);
        return this.mapToProduct(response.data);
    }

    async updateProduct(externalId: string, product: Partial<IProduct>): Promise<IProduct> {
        // ML requires separate updates for different fields
        const updateData: any = {};
        if (product.title) updateData.title = product.title;
        if (product.price) updateData.price = product.price;
        if (product.stock !== undefined) updateData.available_quantity = product.stock;

        const response = await this.client.put(`/items/${externalId}`, updateData);
        return this.mapToProduct(response.data);
    }

    async updateStock(externalId: string, quantity: number): Promise<boolean> {
        try {
            await this.client.put(`/items/${externalId}`, {
                available_quantity: quantity,
            });
            return true;
        } catch {
            return false;
        }
    }

    async updatePrice(externalId: string, price: number, _salePrice?: number): Promise<boolean> {
        try {
            await this.client.put(`/items/${externalId}`, { price });
            return true;
        } catch {
            return false;
        }
    }

    async pauseProduct(externalId: string): Promise<boolean> {
        try {
            await this.client.put(`/items/${externalId}`, { status: "paused" });
            return true;
        } catch {
            return false;
        }
    }

    async activateProduct(externalId: string): Promise<boolean> {
        try {
            await this.client.put(`/items/${externalId}`, { status: "active" });
            return true;
        } catch {
            return false;
        }
    }

    async deleteProduct(externalId: string): Promise<boolean> {
        try {
            await this.client.put(`/items/${externalId}`, { status: "closed" });
            return true;
        } catch {
            return false;
        }
    }

    async getOrder(orderId: string): Promise<any> {
        try {
            const response = await this.client.get(`/orders/${orderId}`);
            return response.data;
        } catch {
            return null;
        }
    }

    private mapToProduct(mlItem: any): IProduct {
        // Get listing type to identify Classic vs Premium
        const listingType = mlItem.listing_type_id || "";
        const isClassic = listingType.includes("free") || listingType === "bronze" || listingType === "silver";
        const isPremium = listingType.includes("gold") || listingType === "platinum";

        // Extract base SKU - prefer seller_custom_field, otherwise use ML ID
        // If seller didn't set SKU, we'll use ML ID which means each ad is a separate product
        let baseSku = mlItem.seller_custom_field || mlItem.id;

        // Clean title for better display
        const title = mlItem.title || "";

        return {
            externalId: mlItem.id,
            sku: baseSku,
            title: title,
            description: "", // Description requires separate API call
            price: mlItem.price || 0,
            stock: mlItem.available_quantity || 0,
            images: mlItem.pictures?.map((pic: any) => pic.url || pic.secure_url) || [],
            category: mlItem.category_id,
            brand: mlItem.attributes?.find((a: any) => a.id === "BRAND")?.value_name,
            condition: mlItem.condition === "new" ? "new" : "used",
            status: mlItem.status === "active" ? "active" : "paused",
            sourceMarketplace: "mercadolibre",
            listingType: isClassic ? "classic" : isPremium ? "premium" : "other",
        };
    }

    private mapToMLProduct(product: IProduct): any {
        return {
            title: product.title,
            category_id: product.category || "MLB1648", // Default category
            price: product.price,
            currency_id: "BRL",
            available_quantity: product.stock,
            buying_mode: "buy_it_now",
            condition: product.condition || "new",
            listing_type_id: "gold_special",
            pictures: product.images?.map((url) => ({ source: url })),
            seller_custom_field: product.sku,
            attributes: [
                ...(product.brand ? [{ id: "BRAND", value_name: product.brand }] : []),
            ],
        };
    }

    // OAuth Helper Methods
    static getAuthUrl(appId: string, redirectUri: string): string {
        return `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    }

    static async exchangeCodeForToken(
        code: string,
        appId: string,
        clientSecret: string,
        redirectUri: string
    ): Promise<any> {
        const response = await axios.post("https://api.mercadolibre.com/oauth/token", {
            grant_type: "authorization_code",
            client_id: appId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
        });
        return response.data;
    }

    static async refreshToken(refreshToken: string, appId: string, clientSecret: string): Promise<any> {
        const response = await axios.post("https://api.mercadolibre.com/oauth/token", {
            grant_type: "refresh_token",
            client_id: appId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
        });
        return response.data;
    }
}
