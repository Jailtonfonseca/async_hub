import axios, { AxiosInstance } from "axios";
import { createHmac } from "crypto";
import { IMarketplace, IProduct, IConnectionCredentials } from "../interfaces/IMarketplace";

/**
 * Shopee Open Platform Adapter
 *
 * Autenticação: partner_id (apiKey) + partner_key (apiSecret)
 * + access_token após OAuth.
 *
 * Docs: https://openplatform.shopee.com/docs/
 */
export class ShopeeAdapter implements IMarketplace {
  name = "shopee";

  private partnerId: number;
  private partnerKey: string;
  private accessToken: string;
  private shopId: number;
  private baseURL: string;

  constructor(credentials: IConnectionCredentials) {
    this.partnerId = parseInt(credentials.apiKey || "0", 10);
    this.partnerKey = credentials.apiSecret || "";
    this.accessToken = credentials.accessToken || "";
    this.shopId = parseInt(credentials.userId || "0", 10);
    const env = process.env.NODE_ENV || "development";
    this.baseURL =
      env === "production"
        ? "https://partner.shopeemobile.com"
        : "https://partner.test-stable.shopeemobile.com";
  }

  /**
   * Generate HMAC-SHA256 signature required by Shopee API
   */
  private generateSignature(
    path: string,
    timestamp: number,
    accessToken?: string
  ): string {
    const baseString = `${this.partnerId}${path}${timestamp}${accessToken || ""}`;
    return createHmac("sha256", this.partnerKey)
      .update(baseString)
      .digest("hex");
  }

  /**
   * Make an authenticated API call to Shopee
   */
  private async apiCall<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = this.generateSignature(path, timestamp, this.accessToken);

    const params: Record<string, string | number> = {
      partner_id: this.partnerId,
      timestamp,
      sign,
    };
    if (this.accessToken) params["access_token"] = this.accessToken;
    if (this.shopId) params["shop_id"] = this.shopId;

    try {
      const response = await axios({
        method,
        url: `${this.baseURL}${path}`,
        params,
        data: body ? { ...body, partner_id: this.partnerId } : undefined,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = response.data;

      if (data.error) {
        throw new Error(`Shopee API error: ${data.error} - ${data.message || ""}`);
      }

      return data as T;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Unknown Shopee API error");
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.apiCall<{ response: { shop_name?: string } }>(
        "GET",
        "/api/v2/shop/get_shop_detail"
      );
      return !!result.response?.shop_name;
    } catch {
      return false;
    }
  }

  async getProducts(limit = 100, _offset = 0): Promise<IProduct[]> {
    try {
      const result = await this.apiCall<{
        response: {
          item_list?: Array<{
            item_id: number;
            item_name: string;
            price_info?: Array<{ original_price: number }>;
            stock: number;
            images?: string[];
            description?: string;
            category_id?: number;
            status?: string;
          }>;
          total_count?: number;
          more?: boolean;
        };
      }>("POST", "/api/v2/product/get_item_list", {
        pagination: {
          offset: _offset,
          page_size: Math.min(limit, 100),
        },
      });

      const items = result.response?.item_list || [];
      const products: IProduct[] = [];

      for (const item of items) {
        const detail = await this.getProduct(String(item.item_id));
        if (detail) {
          products.push(detail);
        }
      }

      return products;
    } catch (error: unknown) {
      console.error(
        "Shopee getProducts error:",
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  async getProduct(externalId: string): Promise<IProduct | null> {
    try {
      const result = await this.apiCall<{
        response: {
          item_id: number;
          item_name: string;
          item_sku?: string;
          price_info?: Array<{ original_price: number }>;
          stock: number;
          images?: string[];
          description?: string;
          category_id?: number;
          weight?: string;
          dimension?: {
            package_height: number;
            package_length: number;
            package_width: number;
          };
          brand?: string;
          condition?: string;
          attributes?: Array<{
            attribute_id: number;
            attribute_name: string;
            value: string;
          }>;
          status?: string;
        };
      }>("POST", "/api/v2/product/get_item_base_info", {
        item_id_list: [parseInt(externalId, 10)],
      });

      const item = result.response;
      if (!item || !item.item_id) return null;

      return {
        externalId: String(item.item_id),
        sku: item.item_sku || `shopee_${item.item_id}`,
        title: item.item_name,
        description: item.description || "",
        price: item.price_info?.[0]?.original_price || 0,
        stock: item.stock || 0,
        images: item.images || [],
        category: String(item.category_id || ""),
        brand: item.brand || "",
        condition: item.condition === "2" ? "used" : "new",
        weight: item.weight ? parseFloat(item.weight) : undefined,
        dimensions: item.dimension
          ? {
              height: item.dimension.package_height,
              width: item.dimension.package_width,
              length: item.dimension.package_length,
            }
          : undefined,
        attributes: item.attributes
          ? Object.fromEntries(
              item.attributes.map((a) => [a.attribute_name, a.value])
            )
          : undefined,
        sourceMarketplace: "shopee",
        status: item.status === "NORMAL" ? "active" : "paused",
      };
    } catch (error: unknown) {
      console.error(
        `Shopee getProduct ${externalId} error:`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  async createProduct(product: IProduct): Promise<IProduct> {
    const body: Record<string, unknown> = {
      item_name: product.title,
      description: product.description,
      price: product.price,
      stock: product.stock,
      weight: product.weight || 0.5,
      item_sku: product.sku,
    };

    if (product.images && product.images.length > 0) {
      body["image"] = product.images;
    }

    if (product.dimensions) {
      body["dimension"] = {
        package_height: product.dimensions.height,
        package_length: product.dimensions.length,
        package_width: product.dimensions.width,
      };
    }

    const result = await this.apiCall<{ response: { item_id: number } }>(
      "POST",
      "/api/v2/product/add_item",
      body
    );

    return { ...product, externalId: String(result.response?.item_id) };
  }

  async updateProduct(
    externalId: string,
    product: Partial<IProduct>
  ): Promise<IProduct> {
    const body: Record<string, unknown> = {
      item_id: parseInt(externalId, 10),
    };

    if (product.title) body["item_name"] = product.title;
    if (product.description) body["description"] = product.description;
    if (product.price) body["price"] = product.price;
    if (product.stock !== undefined) body["stock"] = product.stock;
    if (product.weight) body["weight"] = product.weight;

    await this.apiCall<{ response: Record<string, unknown> }>(
      "POST",
      "/api/v2/product/update_item",
      body
    );

    return product as IProduct;
  }

  async updateStock(externalId: string, quantity: number): Promise<boolean> {
    try {
      await this.apiCall<{ response: Record<string, unknown> }>(
        "POST",
        "/api/v2/product/update_stock",
        {
          item_id: parseInt(externalId, 10),
          stock: quantity,
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async updatePrice(
    externalId: string,
    price: number,
    _salePrice?: number
  ): Promise<boolean> {
    try {
      await this.apiCall<{ response: Record<string, unknown> }>(
        "POST",
        "/api/v2/product/update_price",
        {
          item_id: parseInt(externalId, 10),
          price,
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async pauseProduct(externalId: string): Promise<boolean> {
    try {
      await this.apiCall<{ response: Record<string, unknown> }>(
        "POST",
        "/api/v2/product/unlist_item",
        {
          item_id: [parseInt(externalId, 10)],
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async activateProduct(externalId: string): Promise<boolean> {
    try {
      await this.apiCall<{ response: Record<string, unknown> }>(
        "POST",
        "/api/v2/product/init_item",
        {
          item_id: parseInt(externalId, 10),
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  async deleteProduct(externalId: string): Promise<boolean> {
    try {
      await this.apiCall<{ response: Record<string, unknown> }>(
        "POST",
        "/api/v2/product/delete_item",
        {
          item_id: [parseInt(externalId, 10)],
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  // ---- Statics ----

  static getAuthUrl(partnerId: string, redirectUri: string): string {
    const isProduction = process.env.NODE_ENV === "production";
    const base = isProduction
      ? "https://partner.shopeemobile.com"
      : "https://partner.test-stable.shopeemobile.com";

    const timestamp = Math.floor(Date.now() / 1000);

    return `${base}/api/v2/shop/auth_partner?id=${partnerId}&token=${timestamp}&redirect=${encodeURIComponent(redirectUri)}`;
  }
}
