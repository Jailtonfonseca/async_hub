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
exports.WooCommerceAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
class WooCommerceAdapter {
    constructor(credentials) {
        this.name = "woocommerce";
        this.credentials = credentials;
        this.client = axios_1.default.create({
            baseURL: `${credentials.apiUrl}/wp-json/wc/v3`,
            auth: {
                username: credentials.apiKey || "",
                password: credentials.apiSecret || "",
            },
        });
    }
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.get("/system_status");
                return response.status === 200;
            }
            catch (_a) {
                return false;
            }
        });
    }
    getProducts() {
        return __awaiter(this, arguments, void 0, function* (limit = 100, offset = 0) {
            const response = yield this.client.get("/products", {
                params: { per_page: limit, offset },
            });
            return response.data.map((p) => this.mapToProduct(p));
        });
    }
    getProduct(externalId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.get(`/products/${externalId}`);
                return this.mapToProduct(response.data);
            }
            catch (_a) {
                return null;
            }
        });
    }
    createProduct(product) {
        return __awaiter(this, void 0, void 0, function* () {
            const wooProduct = this.mapToWooProduct(product);
            const response = yield this.client.post("/products", wooProduct);
            return this.mapToProduct(response.data);
        });
    }
    updateProduct(externalId, product) {
        return __awaiter(this, void 0, void 0, function* () {
            const wooProduct = this.mapToWooProduct(product);
            const response = yield this.client.put(`/products/${externalId}`, wooProduct);
            return this.mapToProduct(response.data);
        });
    }
    updateStock(externalId, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.client.put(`/products/${externalId}`, {
                    stock_quantity: quantity,
                    manage_stock: true,
                });
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    updatePrice(externalId, price, salePrice) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = { regular_price: price.toString() };
                if (salePrice)
                    data.sale_price = salePrice.toString();
                yield this.client.put(`/products/${externalId}`, data);
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
                yield this.client.put(`/products/${externalId}`, { status: "draft" });
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
                yield this.client.put(`/products/${externalId}`, { status: "publish" });
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
                yield this.client.delete(`/products/${externalId}`, { params: { force: true } });
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    mapToProduct(wooProduct) {
        var _a, _b, _c, _d, _e, _f, _g;
        return {
            externalId: (_a = wooProduct.id) === null || _a === void 0 ? void 0 : _a.toString(),
            sku: wooProduct.sku || "",
            title: wooProduct.name || "",
            description: wooProduct.description || "",
            price: parseFloat(wooProduct.regular_price) || 0,
            salePrice: wooProduct.sale_price ? parseFloat(wooProduct.sale_price) : undefined,
            stock: wooProduct.stock_quantity || 0,
            images: ((_b = wooProduct.images) === null || _b === void 0 ? void 0 : _b.map((img) => img.src)) || [],
            category: (_d = (_c = wooProduct.categories) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.name,
            brand: (_g = (_f = (_e = wooProduct.attributes) === null || _e === void 0 ? void 0 : _e.find((a) => a.name === "Marca")) === null || _f === void 0 ? void 0 : _f.options) === null || _g === void 0 ? void 0 : _g[0],
            condition: "new",
            weight: wooProduct.weight ? parseFloat(wooProduct.weight) : undefined,
            dimensions: wooProduct.dimensions ? {
                height: parseFloat(wooProduct.dimensions.height) || 0,
                width: parseFloat(wooProduct.dimensions.width) || 0,
                length: parseFloat(wooProduct.dimensions.length) || 0,
            } : undefined,
            status: wooProduct.status === "publish" ? "active" : "paused",
            sourceMarketplace: "woocommerce",
        };
    }
    mapToWooProduct(product) {
        var _a, _b, _c, _d;
        return {
            name: product.title,
            sku: product.sku,
            description: product.description,
            regular_price: (_a = product.price) === null || _a === void 0 ? void 0 : _a.toString(),
            sale_price: (_b = product.salePrice) === null || _b === void 0 ? void 0 : _b.toString(),
            stock_quantity: product.stock,
            manage_stock: true,
            images: (_c = product.images) === null || _c === void 0 ? void 0 : _c.map((src) => ({ src })),
            weight: (_d = product.weight) === null || _d === void 0 ? void 0 : _d.toString(),
            dimensions: product.dimensions ? {
                height: product.dimensions.height.toString(),
                width: product.dimensions.width.toString(),
                length: product.dimensions.length.toString(),
            } : undefined,
            status: product.status === "active" ? "publish" : "draft",
        };
    }
}
exports.WooCommerceAdapter = WooCommerceAdapter;
