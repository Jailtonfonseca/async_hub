import SellingPartnerAPI from "amazon-sp-api";
import { IMarketplace, IProduct, IConnectionCredentials } from "../interfaces/IMarketplace";

interface AmazonClientConfig {
    region: string;
    refresh_token: string;
    credentials: {
        SELLING_PARTNER_APP_CLIENT_ID: string;
        SELLING_PARTNER_APP_CLIENT_SECRET: string;
        AWS_ACCESS_KEY_ID: string;
        AWS_SECRET_ACCESS_KEY: string;
    };
}

interface AmazonProductResponse {
    items?: Array<Record<string, unknown>>;
    pagination?: {
        nextToken?: string;
    };
}

interface AmazonSellerResponse {
    payload?: Array<{ sellerId?: string }>;
}

interface AmazonListingsItemResponse {
    summaries?: Array<Record<string, unknown>>;
    attributes?: Record<string, unknown>;
    offers?: Array<Record<string, unknown>>;
    images?: Record<string, unknown>;
}

export class AmazonAdapter implements IMarketplace {
    name = "amazon";
    private client: any;
    private credentials: IConnectionCredentials;
    private sellerIdCache: string | null = null;

    constructor(credentials: IConnectionCredentials) {
        this.credentials = credentials;

        // Validate required credentials
        if (!credentials.apiKey || !credentials.apiSecret || !credentials.accessToken || !credentials.userId) {
            throw new Error("Missing required Amazon credentials");
        }

        // Initialize SP-API client
        // Note: amazon-sp-api types are not fully compatible, using 'any' for constructor
        const config = {
            region: this.getRegionFromUrl(credentials.apiUrl),
            refresh_token: credentials.refreshToken || "",
            credentials: {
                SELLING_PARTNER_APP_CLIENT_ID: credentials.apiKey,
                SELLING_PARTNER_APP_CLIENT_SECRET: credentials.apiSecret,
                AWS_ACCESS_KEY_ID: credentials.accessToken,
                AWS_SECRET_ACCESS_KEY: credentials.userId,
            },
        };
        this.client = new (SellingPartnerAPI as any)(config as any);
    }

    /**
     * Convert API URL format to Amazon region format
     */
    private getRegionFromUrl(apiUrl?: string): string {
        if (!apiUrl) return "NA"; // Default to North America
        
        const regionMap: Record<string, string> = {
            "us-east-1": "NA",
            "us-west-2": "NA",
            "eu-west-1": "EU",
            "eu-central-1": "EU",
            "fe-1": "FE", // Far East
        };
        
        return regionMap[apiUrl] || "NA";
    }

    async testConnection(): Promise<boolean> {
        try {
            // Test connection by getting seller info
            const response = await this.client.callAPI({
                operation: "getSellers",
                endpoint: "sellers",
                query: {
                    marketplaceIds: this.getMarketplaceId(),
                },
            }) as AmazonSellerResponse;
            
            return !!(response.payload && response.payload.length > 0);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("Amazon connection test failed:", errorMessage);
            throw new Error(`Amazon connection failed: ${errorMessage}`);
        }
    }

    async getProducts(limit = 50, offset = 0): Promise<IProduct[]> {
        try {
            const allProducts: IProduct[] = [];
            let pageToken: string | undefined = undefined;
            let currentPage = 0;
            
            // Paginate through all products until we reach the offset
            while (currentPage * limit < offset || allProducts.length < limit) {
                const response = await this.client.callAPI({
                    operation: "getListingsItem",
                    endpoint: "listings",
                    path: {
                        sellerId: await this.getSellerId(),
                    },
                    query: {
                        marketplaceIds: this.getMarketplaceId(),
                        pageSize: Math.min(limit, 50), // Amazon max page size is 50
                        pageToken,
                    },
                }) as AmazonProductResponse;

                const items = (response.items || []) as Array<Record<string, unknown>>;
                
                // Skip items before offset
                if (currentPage * limit < offset) {
                    const skipCount = Math.min(items.length, offset - currentPage * limit);
                    const remainingItems = items.slice(skipCount);
                    allProducts.push(...remainingItems.map((item) => this.mapToProduct(item)));
                } else {
                    allProducts.push(...items.map((item) => this.mapToProduct(item)));
                }

                // Check if there are more pages
                if (!response.pagination?.nextToken) {
                    break;
                }
                pageToken = response.pagination.nextToken;
                currentPage++;
                
                // Safety limit to prevent infinite loops
                if (currentPage > 100) {
                    console.warn("AmazonAdapter: Reached maximum pagination limit");
                    break;
                }
            }

            return allProducts.slice(0, limit);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("Failed to get Amazon products:", errorMessage);
            throw new Error(`Failed to fetch Amazon products: ${errorMessage}`);
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
            }) as AmazonListingsItemResponse;

            return this.mapToProduct(response as Record<string, unknown>);
        } catch (error: unknown) {
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
                    productType: "PRODUCT",
                    requirements: "LISTING",
                    attributes: amazonProduct,
                },
            });

            // Return the created product
            return { ...product, externalId: product.sku };
        } catch (error: unknown) {
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
        } catch (error: unknown) {
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
        } catch (error: unknown) {
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
        } catch (error: unknown) {
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
        } catch (error: unknown) {
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
        } catch (error: unknown) {
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
        } catch (error: unknown) {
            console.error("Failed to delete Amazon product:", error);
            return false;
        }
    }

    // Helper method to map Amazon product to IProduct
    private mapToProduct(amazonItem: Record<string, unknown>): IProduct {
        const summaries = (amazonItem.summaries?.[0] || {}) as Record<string, unknown>;
        const attributes = (amazonItem.attributes || {}) as Record<string, unknown>;
        const offers = (amazonItem.offers?.[0] || {}) as Record<string, unknown>;
        const images = (amazonItem.images || {}) as Record<string, unknown>;

        return {
            externalId: (summaries.sku as string) || "",
            sku: (summaries.sku as string) || "",
            title: (summaries.itemName as string) || (attributes.item_name as Array<{ value: string }>)?.[0]?.value || "",
            description: ((attributes.bullet_point as Array<{ value: string }>)?.map((bp) => bp.value).join("\n")) || "",
            price: (offers.price as { amount: number })?.amount || 0,
            salePrice: (offers.salePrice as { amount: number })?.amount,
            stock: (summaries.quantity as number) || 0,
            images: (images.main as Array<{ link: string }>)?.map((img) => img.link) || [],
            category: (summaries.productType as string) || "",
            brand: (attributes.brand as Array<{ value: string }>)?.[0]?.value || "",
            condition: (summaries.condition as string) === "new_new" ? "new" : "used",
            status: (summaries.status as string) === "ACTIVE" ? "active" : "paused",
            sourceMarketplace: "amazon",
        };
    }

    // Helper method to map IProduct to Amazon format
    private mapToAmazonProduct(product: IProduct): Record<string, unknown> {
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
            }) as AmazonSellerResponse;

            this.sellerIdCache = response.payload?.[0]?.sellerId || "";
            if (!this.sellerIdCache) {
                throw new Error("Unable to retrieve seller ID from Amazon API");
            }
            return this.sellerIdCache;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("Failed to get seller ID:", errorMessage);
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
    ): Promise<Record<string, unknown>> {
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

        return response.json() as Promise<Record<string, unknown>>;
    }

    static async refreshToken(
        refreshToken: string,
        clientId: string,
        clientSecret: string
    ): Promise<Record<string, unknown>> {
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

        return response.json() as Promise<Record<string, unknown>>;
    }
}
