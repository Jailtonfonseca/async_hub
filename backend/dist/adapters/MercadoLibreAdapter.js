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
exports.MercadoLibreAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
class MercadoLibreAdapter {
    constructor(credentials) {
        this.name = "mercadolibre";
        this.credentials = credentials;
        this.userId = credentials.userId || "";
        this.client = axios_1.default.create({
            baseURL: "https://api.mercadolibre.com",
            headers: {
                Authorization: `Bearer ${credentials.accessToken}`,
                "Content-Type": "application/json",
            },
        });
    }
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.get("/users/me");
                return response.status === 200;
            }
            catch (_a) {
                return false;
            }
        });
    }
    getProducts() {
        return __awaiter(this, arguments, void 0, function* (limit = 50, offset = 0) {
            const searchResponse = yield this.client.get(`/users/${this.userId}/items/search`, {
                params: { limit, offset },
            });
            const itemIds = searchResponse.data.results || [];
            if (itemIds.length === 0)
                return [];
            const idsParam = itemIds.join(",");
            const itemsResponse = yield this.client.get(`/items`, {
                params: { ids: idsParam },
            });
            return itemsResponse.data.map((item) => this.mapToProduct(item.body));
        });
    }
    getProduct(externalId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.get(`/items/${externalId}`);
                return this.mapToProduct(response.data);
            }
            catch (_a) {
                return null;
            }
        });
    }
    createProduct(product) {
        return __awaiter(this, void 0, void 0, function* () {
            const mlProduct = this.mapToMLProduct(product);
            const response = yield this.client.post("/items", mlProduct);
            return this.mapToProduct(response.data);
        });
    }
    updateProduct(externalId, product) {
        return __awaiter(this, void 0, void 0, function* () {
            // ML requires separate updates for different fields
            const updateData = {};
            if (product.title)
                updateData.title = product.title;
            if (product.price)
                updateData.price = product.price;
            if (product.stock !== undefined)
                updateData.available_quantity = product.stock;
            const response = yield this.client.put(`/items/${externalId}`, updateData);
            return this.mapToProduct(response.data);
        });
    }
    updateStock(externalId, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.client.put(`/items/${externalId}`, {
                    available_quantity: quantity,
                });
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    updatePrice(externalId, price, _salePrice) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.client.put(`/items/${externalId}`, { price });
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    pauseProduct(externalId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.client.put(`/items/${externalId}`, { status: "paused" });
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    activateProduct(externalId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.client.put(`/items/${externalId}`, { status: "active" });
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    deleteProduct(externalId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.client.put(`/items/${externalId}`, { status: "closed" });
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    getOrder(orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.get(`/orders/${orderId}`);
                return response.data;
            }
            catch (_a) {
                return null;
            }
        });
    }
    mapToProduct(mlItem) {
        var _a, _b, _c;
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
            images: ((_a = mlItem.pictures) === null || _a === void 0 ? void 0 : _a.map((pic) => pic.url || pic.secure_url)) || [],
            category: mlItem.category_id,
            brand: (_c = (_b = mlItem.attributes) === null || _b === void 0 ? void 0 : _b.find((a) => a.id === "BRAND")) === null || _c === void 0 ? void 0 : _c.value_name,
            condition: mlItem.condition === "new" ? "new" : "used",
            status: mlItem.status === "active" ? "active" : "paused",
            sourceMarketplace: "mercadolibre",
            listingType: isClassic ? "classic" : isPremium ? "premium" : "other",
        };
    }
    mapToMLProduct(product) {
        var _a;
        return {
            title: product.title,
            category_id: product.category || "MLB1648", // Default category
            price: product.price,
            currency_id: "BRL",
            available_quantity: product.stock,
            buying_mode: "buy_it_now",
            condition: product.condition || "new",
            listing_type_id: "gold_special",
            pictures: (_a = product.images) === null || _a === void 0 ? void 0 : _a.map((url) => ({ source: url })),
            seller_custom_field: product.sku,
            attributes: [
                ...(product.brand ? [{ id: "BRAND", value_name: product.brand }] : []),
            ],
        };
    }
    // OAuth Helper Methods
    static getAuthUrl(appId, redirectUri) {
        return `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    }
    static exchangeCodeForToken(code, appId, clientSecret, redirectUri) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield axios_1.default.post("https://api.mercadolibre.com/oauth/token", {
                grant_type: "authorization_code",
                client_id: appId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
            });
            return response.data;
        });
    }
    static refreshToken(refreshToken, appId, clientSecret) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield axios_1.default.post("https://api.mercadolibre.com/oauth/token", {
                grant_type: "refresh_token",
                client_id: appId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
            });
            return response.data;
        });
    }
}
exports.MercadoLibreAdapter = MercadoLibreAdapter;
