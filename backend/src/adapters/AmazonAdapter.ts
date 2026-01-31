import SellingPartnerAPI from "amazon-sp-api";
import { IMarketplace, IProduct, IConnectionCredentials } from "../interfaces/IMarketplace";

export class AmazonAdapter implements IMarketplace {
    name = "amazon";
    private client: SellingPartnerAPI;
    private credentials: IConnectionCredentials;

    constructor(credentials: IConnectionCredentials) {
        this.credentials = credentials;

        // Initialize SP-API client
        this.client = new SellingPartnerAPI({
            region: (credentials.apiUrl || "us-east-1") as any, // Using apiUrl to store region
            refresh_token: credentials.refreshToken || "",
            credentials: {
                SELLING_PARTNER_APP_CLIENT_ID: credentials.apiKey || "",
                SELLING_PARTNER_APP_CLIENT_SECRET: credentials.apiSecret || "",
                AWS_ACCESS_KEY_ID: credentials.accessToken || "", // Using accessToken for AWS key
                AWS_SECRET_ACCESS_KEY: credentials.userId || "", // Using userId for AWS secret
            },
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            // Test connection by getting seller info
            await this.client.callAPI({
                operation: "getSellers",
                endpoint: "sellers",
                query: {
                    marketplaceIds: this.getMarketplaceId(),
                },
            });
            return true;
        } catch (error) {
            console.error("Amazon connection test failed:", error);
            return false;
        }
    }

    async getProducts(limit = 20, offset = 0): Promise<IProduct[]> {
        try {
            // Use Listings Items API to get seller's listings
            const response = await this.client.callAPI({
                operation: "getListingsItem",
                endpoint: "listings",
                path: {
                    sellerId: await this.getSellerId(),
                },
                query: {
                    marketplaceIds: this.getMarketplaceId(),
                    pageSize: limit,
                    pageToken: offset > 0 ? String(offset) : undefined,
                },
            });

            const items = response.items || [];
            return items.map((item: any) => this.mapToProduct(item));
        } catch (error) {
            console.error("Failed to get Amazon products:", error);
            return [];
        }
    }

    async getProduct(externalId: string): Promise<IProduct | null> {
        try {
            const sellerId = await this.getSellerId();
            const response = await this.client.callAPI({
                operation: "getListingsItem",
                endpoint: "listings",
                path: {
                    sellerId,
                    sku: externalId,
                },
                query: {
                    marketplaceIds: this.getMarketplaceId(),
                    includedData: ["summaries", "attributes", "offers", "images"],
                },
            });

            return this.mapToProduct(response);
        } catch (error) {
            console.error("Failed to get Amazon product:", error);
            return null;
        }
    }

    async createProduct(product: IProduct): Promise<IProduct> {
        try {
            const sellerId = await this.getSellerId();
            const amazonProduct = this.mapToAmazonProduct(product);

            await this.client.callAPI({
                operation: "putListingsItem",
                endpoint: "listings",
                path: {
                    sellerId,
                    sku: product.sku,
                },
                body: {
                    productType: "PRODUCT", // This should be determined based on category
                    requirements: "LISTING",
                    attributes: amazonProduct,
                },
            });

            // Return the created product
            return { ...product, externalId: product.sku };
        } catch (error) {
            console.error("Failed to create Amazon product:", error);
            throw error;
        }
    }

    async updateProduct(externalId: string, product: Partial<IProduct>): Promise<IProduct> {
        try {
            const sellerId = await this.getSellerId();
            const updateData = this.mapToAmazonProduct(product as IProduct);

            await this.client.callAPI({
                operation: "patchListingsItem",
                endpoint: "listings",
                path: {
                    sellerId,
                    sku: externalId,
                },
                body: {
                    productType: "PRODUCT",
                    patches: [
                        {
                            op: "replace",
                            path: "/attributes",
                            value: [updateData],
                        },
                    ],
                },
            });

            return { ...product, externalId, sku: externalId } as IProduct;
        } catch (error) {
            console.error("Failed to update Amazon product:", error);
            throw error;
        }
    }

    async updateStock(externalId: string, quantity: number): Promise<boolean> {
        try {
            const sellerId = await this.getSellerId();

            await this.client.callAPI({
                operation: "patchListingsItem",
                endpoint: "listings",
                path: {
                    sellerId,
                    sku: externalId,
                },
                body: {
                    productType: "PRODUCT",
                    patches: [
                        {
                            op: "replace",
                            path: "/attributes/fulfillment_availability",
                            value: [
                                {
                                    fulfillment_channel_code: "DEFAULT",
                                    quantity,
                                },
                            ],
                        },
                    ],
                },
            });

            return true;
        } catch (error) {
            console.error("Failed to update Amazon stock:", error);
            return false;
        }
    }

    async updatePrice(externalId: string, price: number, salePrice?: number): Promise<boolean> {
        try {
            const sellerId = await this.getSellerId();

            const priceValue = salePrice || price;

            await this.client.callAPI({
                operation: "patchListingsItem",
                endpoint: "listings",
                path: {
                    sellerId,
                    sku: externalId,
                },
                body: {
                    productType: "PRODUCT",
                    patches: [
                        {
                            op: "replace",
                            path: "/attributes/purchasable_offer",
                            value: [
                                {
                                    marketplace_id: this.getMarketplaceId()[0],
                                    currency: "USD", // Should be configurable based on region
                                    our_price: [
                                        {
                                            schedule: [
                                                {
                                                    value_with_tax: priceValue,
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            });

            return true;
        } catch (error) {
            console.error("Failed to update Amazon price:", error);
            return false;
        }
    }

    async pauseProduct(externalId: string): Promise<boolean> {
        try {
            const sellerId = await this.getSellerId();

            await this.client.callAPI({
                operation: "patchListingsItem",
                endpoint: "listings",
                path: {
                    sellerId,
                    sku: externalId,
                },
                body: {
                    productType: "PRODUCT",
                    patches: [
                        {
                            op: "replace",
                            path: "/attributes/condition_type",
                            value: [
                                {
                                    value: "Inactive",
                                },
                            ],
                        },
                    ],
                },
            });

            return true;
        } catch (error) {
            console.error("Failed to pause Amazon product:", error);
            return false;
        }
    }

    async activateProduct(externalId: string): Promise<boolean> {
        try {
            const sellerId = await this.getSellerId();

            await this.client.callAPI({
                operation: "patchListingsItem",
                endpoint: "listings",
                path: {
                    sellerId,
                    sku: externalId,
                },
                body: {
                    productType: "PRODUCT",
                    patches: [
                        {
                            op: "replace",
                            path: "/attributes/condition_type",
                            value: [
                                {
                                    value: "NewItem",
                                },
                            ],
                        },
                    ],
                },
            });

            return true;
        } catch (error) {
            console.error("Failed to activate Amazon product:", error);
            return false;
        }
    }

    async deleteProduct(externalId: string): Promise<boolean> {
        try {
            const sellerId = await this.getSellerId();

            await this.client.callAPI({
                operation: "deleteListingsItem",
                endpoint: "listings",
                path: {
                    sellerId,
                    sku: externalId,
                },
                query: {
                    marketplaceIds: this.getMarketplaceId(),
                },
            });

            return true;
        } catch (error) {
            console.error("Failed to delete Amazon product:", error);
            return false;
        }
    }

    // Helper method to map Amazon product to IProduct
    private mapToProduct(amazonItem: any): IProduct {
        const summaries = amazonItem.summaries?.[0] || {};
        const attributes = amazonItem.attributes || {};
        const offers = amazonItem.offers?.[0] || {};
        const images = amazonItem.images || {};

        return {
            externalId: summaries.sku || "",
            sku: summaries.sku || "",
            title: summaries.itemName || attributes.item_name?.[0]?.value || "",
            description: attributes.bullet_point?.map((bp: any) => bp.value).join("\n") || "",
            price: offers.price?.amount || 0,
            salePrice: offers.salePrice?.amount,
            stock: summaries.quantity || 0,
            images: images.main?.map((img: any) => img.link) || [],
            category: summaries.productType || "",
            brand: attributes.brand?.[0]?.value || "",
            condition: summaries.condition === "new_new" ? "new" : "used",
            status: summaries.status === "ACTIVE" ? "active" : "paused",
            sourceMarketplace: "amazon",
        };
    }

    // Helper method to map IProduct to Amazon format
    private mapToAmazonProduct(product: IProduct): any {
        return {
            item_name: [{ value: product.title, language_tag: "en_US" }],
            bullet_point: product.description
                ? [{ value: product.description, language_tag: "en_US" }]
                : [],
            brand: product.brand ? [{ value: product.brand }] : [],
            condition_type: [
                {
                    value: product.condition === "new" ? "NewItem" : "UsedLikeNew",
                },
            ],
            fulfillment_availability: [
                {
                    fulfillment_channel_code: "DEFAULT",
                    quantity: product.stock,
                },
            ],
            purchasable_offer: [
                {
                    marketplace_id: this.getMarketplaceId()[0],
                    currency: "USD",
                    our_price: [
                        {
                            schedule: [
                                {
                                    value_with_tax: product.salePrice || product.price,
                                },
                            ],
                        },
                    ],
                },
            ],
        };
    }

    // Helper method to get marketplace ID based on region
    private getMarketplaceId(): string[] {
        const region = this.credentials.apiUrl || "us-east-1";
        const marketplaceMap: Record<string, string> = {
            "us-east-1": "ATVPDKIKX0DER", // US
            "eu-west-1": "A1F83G8C2ARO7P", // UK
            "eu-central-1": "A1PA6795UKMFR9", // Germany
            "us-west-2": "ATVPDKIKX0DER", // US (alternative region)
        };
        return [marketplaceMap[region] || "ATVPDKIKX0DER"];
    }

    // Helper method to get seller ID - cached to avoid multiple API calls
    private sellerIdCache: string | null = null;
    private async getSellerId(): Promise<string> {
        if (this.sellerIdCache) {
            return this.sellerIdCache;
        }

        try {
            const response = await this.client.callAPI({
                operation: "getSellers",
                endpoint: "sellers",
                query: {
                    marketplaceIds: this.getMarketplaceId(),
                },
            });

            this.sellerIdCache = response.payload?.[0]?.sellerId || "";
            return this.sellerIdCache;
        } catch (error) {
            console.error("Failed to get seller ID:", error);
            throw new Error("Unable to retrieve seller ID");
        }
    }

    // OAuth Helper Methods
    static getAuthUrl(clientId: string, redirectUri: string, state?: string): string {
        const params = new URLSearchParams({
            response_type: "code",
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: "sellingpartnerapi::listings:item:read sellingpartnerapi::listings:item:write sellingpartnerapi::seller:read",
        });

        if (state) {
            params.append("state", state);
        }

        return `https://sellercentral.amazon.com/apps/authorize/consent?${params.toString()}`;
    }

    static async exchangeCodeForToken(
        code: string,
        clientId: string,
        clientSecret: string,
        redirectUri: string
    ): Promise<any> {
        const response = await fetch("https://api.amazon.com/auth/o2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
            }).toString(),
        });

        if (!response.ok) {
            throw new Error(`Token exchange failed: ${response.statusText}`);
        }

        return response.json();
    }

    static async refreshToken(
        refreshToken: string,
        clientId: string,
        clientSecret: string
    ): Promise<any> {
        const response = await fetch("https://api.amazon.com/auth/o2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret,
            }).toString(),
        });

        if (!response.ok) {
            throw new Error(`Token refresh failed: ${response.statusText}`);
        }

        return response.json();
    }
}
