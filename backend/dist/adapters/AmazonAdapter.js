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
exports.AmazonAdapter = void 0;
const amazon_sp_api_1 = __importDefault(require("amazon-sp-api"));
class AmazonAdapter {
    constructor(credentials) {
        this.name = "amazon";
        // Helper method to get seller ID - cached to avoid multiple API calls
        this.sellerIdCache = null;
        this.credentials = credentials;
        // Validate required credentials
        if (!credentials.apiKey || !credentials.apiSecret || !credentials.accessToken || !credentials.userId) {
            throw new Error("Missing required Amazon credentials");
        }
        // Initialize SP-API client with proper typing
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
        this.client = new amazon_sp_api_1.default(config);
    }
    /**
     * Convert API URL format to Amazon region format
     */
    getRegionFromUrl(apiUrl) {
        if (!apiUrl)
            return "NA"; // Default to North America
        const regionMap = {
            "us-east-1": "NA",
            "us-west-2": "NA",
            "eu-west-1": "EU",
            "eu-central-1": "EU",
            "fe-1": "FE", // Far East
        };
        return regionMap[apiUrl] || "NA";
    }
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Test connection by getting seller info
                yield this.client.callAPI({
                    operation: "getSellers",
                    endpoint: "sellers",
                    query: {
                        marketplaceIds: this.getMarketplaceId(),
                    },
                });
                return true;
            }
            catch (error) {
                console.error("Amazon connection test failed:", error.message || error);
                throw new Error(`Amazon connection failed: ${error.message || "Unknown error"}`);
            }
        });
    }
    getProducts() {
        return __awaiter(this, arguments, void 0, function* (limit = 50, offset = 0) {
            var _a;
            try {
                const allProducts = [];
                let pageToken = undefined;
                let currentPage = 0;
                // Paginate through all products until we reach the offset
                while (currentPage * limit < offset || allProducts.length < limit) {
                    const response = yield this.client.callAPI({
                        operation: "getListingsItem",
                        endpoint: "listings",
                        path: {
                            sellerId: yield this.getSellerId(),
                        },
                        query: {
                            marketplaceIds: this.getMarketplaceId(),
                            pageSize: Math.min(limit, 50), // Amazon max page size is 50
                            pageToken,
                        },
                    });
                    const items = response.items || [];
                    // Skip items before offset
                    if (currentPage * limit < offset) {
                        const skipCount = Math.min(items.length, offset - currentPage * limit);
                        const remainingItems = items.slice(skipCount);
                        allProducts.push(...remainingItems.map((item) => this.mapToProduct(item)));
                    }
                    else {
                        allProducts.push(...items.map((item) => this.mapToProduct(item)));
                    }
                    // Check if there are more pages
                    if (!((_a = response.pagination) === null || _a === void 0 ? void 0 : _a.nextToken)) {
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
            }
            catch (error) {
                console.error("Failed to get Amazon products:", error.message || error);
                throw new Error(`Failed to fetch Amazon products: ${error.message || "Unknown error"}`);
            }
        });
    }
    getProduct(externalId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sellerId = yield this.getSellerId();
                const response = yield this.client.callAPI({
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
            }
            catch (error) {
                console.error("Failed to get Amazon product:", error);
                return null;
            }
        });
    }
    createProduct(product) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sellerId = yield this.getSellerId();
                const amazonProduct = this.mapToAmazonProduct(product);
                yield this.client.callAPI({
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
                return Object.assign(Object.assign({}, product), { externalId: product.sku });
            }
            catch (error) {
                console.error("Failed to create Amazon product:", error);
                throw error;
            }
        });
    }
    updateProduct(externalId, product) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sellerId = yield this.getSellerId();
                const updateData = this.mapToAmazonProduct(product);
                yield this.client.callAPI({
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
                return Object.assign(Object.assign({}, product), { externalId, sku: externalId });
            }
            catch (error) {
                console.error("Failed to update Amazon product:", error);
                throw error;
            }
        });
    }
    updateStock(externalId, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sellerId = yield this.getSellerId();
                yield this.client.callAPI({
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
            }
            catch (error) {
                console.error("Failed to update Amazon stock:", error);
                return false;
            }
        });
    }
    updatePrice(externalId, price, salePrice) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sellerId = yield this.getSellerId();
                const priceValue = salePrice || price;
                yield this.client.callAPI({
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
            }
            catch (error) {
                console.error("Failed to update Amazon price:", error);
                return false;
            }
        });
    }
    pauseProduct(externalId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sellerId = yield this.getSellerId();
                yield this.client.callAPI({
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
            }
            catch (error) {
                console.error("Failed to pause Amazon product:", error);
                return false;
            }
        });
    }
    activateProduct(externalId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sellerId = yield this.getSellerId();
                yield this.client.callAPI({
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
            }
            catch (error) {
                console.error("Failed to activate Amazon product:", error);
                return false;
            }
        });
    }
    deleteProduct(externalId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sellerId = yield this.getSellerId();
                yield this.client.callAPI({
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
            }
            catch (error) {
                console.error("Failed to delete Amazon product:", error);
                return false;
            }
        });
    }
    // Helper method to map Amazon product to IProduct
    mapToProduct(amazonItem) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const summaries = ((_a = amazonItem.summaries) === null || _a === void 0 ? void 0 : _a[0]) || {};
        const attributes = amazonItem.attributes || {};
        const offers = ((_b = amazonItem.offers) === null || _b === void 0 ? void 0 : _b[0]) || {};
        const images = amazonItem.images || {};
        return {
            externalId: summaries.sku || "",
            sku: summaries.sku || "",
            title: summaries.itemName || ((_d = (_c = attributes.item_name) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.value) || "",
            description: ((_e = attributes.bullet_point) === null || _e === void 0 ? void 0 : _e.map((bp) => bp.value).join("\n")) || "",
            price: ((_f = offers.price) === null || _f === void 0 ? void 0 : _f.amount) || 0,
            salePrice: (_g = offers.salePrice) === null || _g === void 0 ? void 0 : _g.amount,
            stock: summaries.quantity || 0,
            images: ((_h = images.main) === null || _h === void 0 ? void 0 : _h.map((img) => img.link)) || [],
            category: summaries.productType || "",
            brand: ((_k = (_j = attributes.brand) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.value) || "",
            condition: summaries.condition === "new_new" ? "new" : "used",
            status: summaries.status === "ACTIVE" ? "active" : "paused",
            sourceMarketplace: "amazon",
        };
    }
    // Helper method to map IProduct to Amazon format
    mapToAmazonProduct(product) {
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
    getMarketplaceId() {
        const region = this.credentials.apiUrl || "us-east-1";
        const marketplaceMap = {
            "us-east-1": "ATVPDKIKX0DER", // US
            "eu-west-1": "A1F83G8C2ARO7P", // UK
            "eu-central-1": "A1PA6795UKMFR9", // Germany
            "us-west-2": "ATVPDKIKX0DER", // US (alternative region)
        };
        return [marketplaceMap[region] || "ATVPDKIKX0DER"];
    }
    getSellerId() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (this.sellerIdCache) {
                return this.sellerIdCache;
            }
            try {
                const response = yield this.client.callAPI({
                    operation: "getSellers",
                    endpoint: "sellers",
                    query: {
                        marketplaceIds: this.getMarketplaceId(),
                    },
                });
                this.sellerIdCache = ((_b = (_a = response.payload) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.sellerId) || "";
                return this.sellerIdCache;
            }
            catch (error) {
                console.error("Failed to get seller ID:", error);
                throw new Error("Unable to retrieve seller ID");
            }
        });
    }
    // OAuth Helper Methods
    static getAuthUrl(clientId, redirectUri, state) {
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
    static exchangeCodeForToken(code, clientId, clientSecret, redirectUri) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch("https://api.amazon.com/auth/o2/token", {
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
        });
    }
    static refreshToken(refreshToken, clientId, clientSecret) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch("https://api.amazon.com/auth/o2/token", {
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
        });
    }
}
exports.AmazonAdapter = AmazonAdapter;
