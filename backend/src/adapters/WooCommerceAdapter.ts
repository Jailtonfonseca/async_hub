import axios from "axios";
import { IMarketplace, IProduct, IConnectionCredentials } from "../interfaces/IMarketplace";

export class WooCommerceAdapter implements IMarketplace {
    name = "woocommerce";
    private client: any;
    private credentials: IConnectionCredentials;

    constructor(credentials: IConnectionCredentials) {
        this.credentials = credentials;
        this.client = axios.create({
            baseURL: `${credentials.apiUrl}/wp-json/wc/v3`,
            auth: {
                username: credentials.apiKey || "",
                password: credentials.apiSecret || "",
            },
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            const response = await this.client.get("/system_status");
            return response.status === 200;
        } catch {
            return false;
        }
    }

    async getProducts(limit = 100, offset = 0): Promise<IProduct[]> {
        const response = await this.client.get("/products", {
            params: { per_page: limit, offset },
        });

        return response.data.map((p: any) => this.mapToProduct(p));
    }

    async getProduct(externalId: string): Promise<IProduct | null> {
        try {
            const response = await this.client.get(`/products/${externalId}`);
            return this.mapToProduct(response.data);
        } catch {
            return null;
        }
    }

    async createProduct(product: IProduct): Promise<IProduct> {
        const wooProduct = this.mapToWooProduct(product);
        const response = await this.client.post("/products", wooProduct);
        return this.mapToProduct(response.data);
    }

    async updateProduct(externalId: string, product: Partial<IProduct>): Promise<IProduct> {
        const wooProduct = this.mapToWooProduct(product as IProduct);
        const response = await this.client.put(`/products/${externalId}`, wooProduct);
        return this.mapToProduct(response.data);
    }

    async updateStock(externalId: string, quantity: number): Promise<boolean> {
        try {
            await this.client.put(`/products/${externalId}`, {
                stock_quantity: quantity,
                manage_stock: true,
            });
            return true;
        } catch {
            return false;
        }
    }

    async updatePrice(externalId: string, price: number, salePrice?: number): Promise<boolean> {
        try {
            const data: any = { regular_price: price.toString() };
            if (salePrice) data.sale_price = salePrice.toString();
            await this.client.put(`/products/${externalId}`, data);
            return true;
        } catch {
            return false;
        }
    }

    async pauseProduct(externalId: string): Promise<boolean> {
        try {
            await this.client.put(`/products/${externalId}`, { status: "draft" });
            return true;
        } catch {
            return false;
        }
    }

    async activateProduct(externalId: string): Promise<boolean> {
        try {
            await this.client.put(`/products/${externalId}`, { status: "publish" });
            return true;
        } catch {
            return false;
        }
    }

    async deleteProduct(externalId: string): Promise<boolean> {
        try {
            await this.client.delete(`/products/${externalId}`, { params: { force: true } });
            return true;
        } catch {
            return false;
        }
    }

    private mapToProduct(wooProduct: any): IProduct {
        return {
            externalId: wooProduct.id?.toString(),
            sku: wooProduct.sku || "",
            title: wooProduct.name || "",
            description: wooProduct.description || "",
            price: parseFloat(wooProduct.regular_price) || 0,
            salePrice: wooProduct.sale_price ? parseFloat(wooProduct.sale_price) : undefined,
            stock: wooProduct.stock_quantity || 0,
            images: wooProduct.images?.map((img: any) => img.src) || [],
            category: wooProduct.categories?.[0]?.name,
            brand: wooProduct.attributes?.find((a: any) => a.name === "Marca")?.options?.[0],
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

    private mapToWooProduct(product: IProduct): any {
        return {
            name: product.title,
            sku: product.sku,
            description: product.description,
            regular_price: product.price?.toString(),
            sale_price: product.salePrice?.toString(),
            stock_quantity: product.stock,
            manage_stock: true,
            images: product.images?.map((src) => ({ src })),
            weight: product.weight?.toString(),
            dimensions: product.dimensions ? {
                height: product.dimensions.height.toString(),
                width: product.dimensions.width.toString(),
                length: product.dimensions.length.toString(),
            } : undefined,
            status: product.status === "active" ? "publish" : "draft",
        };
    }
}
