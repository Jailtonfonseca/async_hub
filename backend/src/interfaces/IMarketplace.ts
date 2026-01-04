/**
 * Generic Product structure used across all marketplaces
 */
export interface IProduct {
    id?: number;
    externalId?: string; // ID from the marketplace (e.g., MLB123456)
    sku: string;
    title: string;
    description: string;
    price: number;
    salePrice?: number;
    stock: number;
    images: string[];
    category?: string;
    brand?: string;
    condition?: 'new' | 'used';
    weight?: number;
    dimensions?: {
        height: number;
        width: number;
        length: number;
    };
    attributes?: Record<string, string>;
    status?: 'active' | 'paused' | 'deleted';
    sourceMarketplace?: string;
    listingType?: 'classic' | 'premium' | 'other';
    lastSyncedAt?: Date;
}

/**
 * Connection credentials structure
 */
export interface IConnectionCredentials {
    apiUrl?: string;
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    userId?: string;
}

/**
 * Interface that all marketplace adapters must implement
 */
export interface IMarketplace {
    name: string;

    /**
     * Test the connection to the marketplace
     */
    testConnection(): Promise<boolean>;

    /**
     * Get all products from the marketplace
     */
    getProducts(limit?: number, offset?: number): Promise<IProduct[]>;

    /**
     * Get a single product by its external ID
     */
    getProduct(externalId: string): Promise<IProduct | null>;

    /**
     * Create a new product on the marketplace
     */
    createProduct(product: IProduct): Promise<IProduct>;

    /**
     * Update an existing product on the marketplace
     */
    updateProduct(externalId: string, product: Partial<IProduct>): Promise<IProduct>;

    /**
     * Update only the stock of a product
     */
    updateStock(externalId: string, quantity: number): Promise<boolean>;

    /**
     * Update only the price of a product
     */
    updatePrice(externalId: string, price: number, salePrice?: number): Promise<boolean>;

    /**
     * Pause/Deactivate a product listing
     */
    pauseProduct(externalId: string): Promise<boolean>;

    /**
     * Activate a product listing
     */
    activateProduct(externalId: string): Promise<boolean>;

    /**
     * Delete a product from the marketplace
     */
    deleteProduct(externalId: string): Promise<boolean>;
}
