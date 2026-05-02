import { Router, Request, Response, NextFunction } from "express";
import { AppDataSource } from "../data-source";
import { Connection } from "../entities/Connection";
import { WooCommerceAdapter } from "../adapters/WooCommerceAdapter";
import { MercadoLibreAdapter } from "../adapters/MercadoLibreAdapter";
import { AmazonAdapter } from "../adapters/AmazonAdapter";
import { ShopeeAdapter } from "../adapters/ShopeeAdapter";
import { validateRequest, validateBody, validateParams } from "../middlewares/validation";
import {
    woocommerceConnectionSchema,
    mercadolibreConnectionSchema,
    amazonConnectionSchema,
    shopeeConnectionSchema,
    marketplaceParamSchema,
} from "../validations/schemas";
import { ValidationError } from "../middlewares/errorHandler";

const router = Router();
const connectionRepo = () => AppDataSource.getRepository(Connection);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Get all connections
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const connections = await connectionRepo().find();
        // Hide sensitive data
        const safeConnections = connections.map(c => ({
            id: c.id,
            marketplace: c.marketplace,
            isConnected: c.isConnected,
            apiUrl: c.apiUrl,
            updatedAt: c.updatedAt,
        }));
        res.json(safeConnections);
    } catch (error) {
        next(new ValidationError("Failed to fetch connections"));
    }
});

// Get single connection
router.get("/:marketplace", validateParams(marketplaceParamSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const connection = await connectionRepo().findOneBy({ marketplace: req.params.marketplace });
        if (!connection) {
            return res.status(404).json({ error: "Connection not found" });
        }
        res.json({
            id: connection.id,
            marketplace: connection.marketplace,
            isConnected: connection.isConnected,
            apiUrl: connection.apiUrl,
        });
    } catch (error) {
        next(new ValidationError("Failed to fetch connection"));
    }
});

// Create or Update WooCommerce connection
router.post("/woocommerce", validateBody(woocommerceConnectionSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { apiUrl, apiKey, apiSecret } = req.body as { apiUrl: string; apiKey: string; apiSecret: string };

        let connection = await connectionRepo().findOneBy({ marketplace: "woocommerce" });
        if (!connection) {
            connection = new Connection();
            connection.marketplace = "woocommerce";
        }

        connection.apiUrl = apiUrl;
        connection.apiKey = apiKey;
        connection.apiSecret = apiSecret;

        // Test connection
        const adapter = new WooCommerceAdapter({
            apiUrl,
            apiKey,
            apiSecret,
        });
        connection.isConnected = await adapter.testConnection();

        await connectionRepo().save(connection);
        res.json({ success: true, isConnected: connection.isConnected });
    } catch (error) {
        next(new ValidationError("Failed to save connection"));
    }
});

// Create or Update MercadoLibre connection (save credentials)
router.post("/mercadolibre", validateBody(mercadolibreConnectionSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { apiKey, apiSecret } = req.body as { apiKey: string; apiSecret: string };

        let connection = await connectionRepo().findOneBy({ marketplace: "mercadolibre" });
        if (!connection) {
            connection = new Connection();
            connection.marketplace = "mercadolibre";
        }

        connection.apiKey = apiKey;
        connection.apiSecret = apiSecret;
        connection.isConnected = false;

        await connectionRepo().save(connection);
        res.json({ success: true, message: "Credentials saved. Proceed to OAuth." });
    } catch (error) {
        next(new ValidationError("Failed to save connection"));
    }
});

// Get MercadoLibre OAuth URL
router.get("/mercadolibre/auth-url", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const connection = await connectionRepo().findOneBy({ marketplace: "mercadolibre" });
        if (!connection || !connection.apiKey) {
            return res.status(400).json({ error: "MercadoLibre App ID not configured" });
        }

        const redirectUri = req.query.redirect_uri as string || `${FRONTEND_URL}/callback/mercadolibre`;
        const authUrl = MercadoLibreAdapter.getAuthUrl(connection.apiKey, redirectUri);
        res.json({ authUrl });
    } catch (error) {
        next(new ValidationError("Failed to generate auth URL"));
    }
});

// MercadoLibre OAuth Callback
router.post("/mercadolibre/callback", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { code, redirect_uri } = req.body as { code: string; redirect_uri: string };

        if (!code) {
            return res.status(400).json({ error: "Authorization code is required" });
        }

        const connection = await connectionRepo().findOneBy({ marketplace: "mercadolibre" });
        if (!connection || !connection.apiKey || !connection.apiSecret) {
            return res.status(400).json({ error: "MercadoLibre credentials not configured" });
        }

        const tokenData = await MercadoLibreAdapter.exchangeCodeForToken(
            code,
            connection.apiKey,
            connection.apiSecret,
            redirect_uri
        ) as { access_token: string; refresh_token: string; expires_in: number; user_id?: number };

        connection.accessToken = tokenData.access_token;
        connection.refreshToken = tokenData.refresh_token;
        connection.userId = tokenData.user_id?.toString() || "";
        connection.isConnected = true;
        connection.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

        await connectionRepo().save(connection);
        res.json({ success: true, isConnected: true });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "OAuth failed";
        res.status(500).json({ error: errorMessage });
    }
});

// Test connection
router.post("/:marketplace/test", validateParams(marketplaceParamSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const connection = await connectionRepo().findOneBy({ marketplace: req.params.marketplace });
        if (!connection) {
            return res.status(404).json({ error: "Connection not found" });
        }

        let isConnected = false;

        if (req.params.marketplace === "woocommerce") {
            const adapter = new WooCommerceAdapter({
                apiUrl: connection.apiUrl,
                apiKey: connection.apiKey,
                apiSecret: connection.apiSecret,
            });
            isConnected = await adapter.testConnection();
        } else if (req.params.marketplace === "mercadolibre") {
            const adapter = new MercadoLibreAdapter({
                accessToken: connection.accessToken,
                userId: connection.userId,
            });
            isConnected = await adapter.testConnection();
        } else if (req.params.marketplace === "amazon") {
            const adapter = new AmazonAdapter({
                apiKey: connection.apiKey,
                apiSecret: connection.apiSecret,
                accessToken: connection.accessToken,
                userId: connection.userId,
                apiUrl: connection.apiUrl,
                refreshToken: connection.refreshToken,
            });
            isConnected = await adapter.testConnection();
        } else if (req.params.marketplace === "shopee") {
            const adapter = new ShopeeAdapter({
                apiKey: connection.apiKey,
                apiSecret: connection.apiSecret,
                accessToken: connection.accessToken,
                userId: connection.userId,
            });
            isConnected = await adapter.testConnection();
        }

        connection.isConnected = isConnected;
        await connectionRepo().save(connection);

        res.json({ isConnected });
    } catch (error) {
        next(new ValidationError("Test failed"));
    }
});

// Create or Update Amazon connection (save credentials)
router.post("/amazon", validateBody(amazonConnectionSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { apiKey, apiSecret, accessToken, userId, apiUrl, refreshToken } = req.body as {
            apiKey: string;
            apiSecret: string;
            accessToken: string;
            userId: string;
            apiUrl: string;
            refreshToken?: string;
        };

        let connection = await connectionRepo().findOneBy({ marketplace: "amazon" });
        if (!connection) {
            connection = new Connection();
            connection.marketplace = "amazon";
        }

        connection.apiKey = apiKey; // LWA Client ID
        connection.apiSecret = apiSecret; // LWA Client Secret
        connection.accessToken = accessToken; // AWS Access Key ID
        connection.userId = userId; // AWS Secret Access Key
        connection.apiUrl = apiUrl; // AWS Region
        connection.refreshToken = refreshToken || "";
        connection.isConnected = false;

        await connectionRepo().save(connection);
        res.json({ success: true, message: "Credentials saved. Proceed to OAuth." });
    } catch (error) {
        next(new ValidationError("Failed to save connection"));
    }
});

// Get Amazon OAuth URL
router.get("/amazon/auth-url", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const connection = await connectionRepo().findOneBy({ marketplace: "amazon" });
        if (!connection || !connection.apiKey) {
            return res.status(400).json({ error: "Amazon LWA Client ID not configured" });
        }

        const redirectUri = req.query.redirect_uri as string || `${FRONTEND_URL}/callback/amazon`;
        const state = req.query.state as string || "";
        const authUrl = AmazonAdapter.getAuthUrl(connection.apiKey, redirectUri, state);
        res.json({ authUrl });
    } catch (error) {
        next(new ValidationError("Failed to generate auth URL"));
    }
});

// Amazon OAuth Callback
router.post("/amazon/callback", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { code, redirect_uri } = req.body as { code: string; redirect_uri: string };

        if (!code) {
            return res.status(400).json({ error: "Authorization code is required" });
        }

        const connection = await connectionRepo().findOneBy({ marketplace: "amazon" });
        if (!connection || !connection.apiKey || !connection.apiSecret) {
            return res.status(400).json({ error: "Amazon credentials not configured" });
        }

        const tokenData = await AmazonAdapter.exchangeCodeForToken(
            code,
            connection.apiKey,
            connection.apiSecret,
            redirect_uri
        ) as { refresh_token: string; expires_in: number };

        connection.refreshToken = tokenData.refresh_token;
        connection.isConnected = true;
        connection.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

        await connectionRepo().save(connection);
        res.json({ success: true, isConnected: true });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "OAuth failed";
        res.status(500).json({ error: errorMessage });
    }
});

// === SHOPEE ===
router.post("/shopee", validateBody(shopeeConnectionSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { apiKey, apiSecret } = req.body;
        let connection = await connectionRepo().findOneBy({ marketplace: "shopee" });

        if (!connection) {
            connection = new Connection();
            connection.marketplace = "shopee";
        }

        connection.apiKey = apiKey;
        connection.apiSecret = apiSecret;
        await connectionRepo().save(connection);

        res.json({ success: true, message: "Shopee credentials saved" });
    } catch (error) {
        next(error);
    }
});

router.get("/shopee/auth-url", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const connection = await connectionRepo().findOneBy({ marketplace: "shopee" });
        if (!connection || !connection.apiKey) {
            return res.status(400).json({ error: "Shopee not configured. Save Partner ID first." });
        }

        const redirectUri = req.query.redirect_uri as string || `${FRONTEND_URL}/callback/shopee`;
        const authUrl = ShopeeAdapter.getAuthUrl(connection.apiKey, redirectUri);
        res.json({ authUrl });
    } catch (error) {
        next(error);
    }
});

router.post("/shopee/callback", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { code, shop_id, redirect_uri } = req.body as {
            code: string;
            shop_id: number;
            redirect_uri: string;
        };

        const connection = await connectionRepo().findOneBy({ marketplace: "shopee" });
        if (!connection) {
            return res.status(400).json({ error: "Shopee not configured" });
        }

        if (!code) {
            return res.status(400).json({ error: "Authorization code is required" });
        }

        // Shopee OAuth: exchange code for access token
        const timestamp = Math.floor(Date.now() / 1000);
        const { createHmac } = await import("crypto");
        const sign = createHmac("sha256", connection.apiSecret || "")
            .update(`${connection.apiKey}${"/api/v2/auth/token/get"}${timestamp}`)
            .digest("hex");

        const tokenResponse = await fetch(
            `${process.env.NODE_ENV === "production" ? "https://partner.shopeemobile.com" : "https://partner.test-stable.shopeemobile.com"}/api/v2/auth/token/get?partner_id=${connection.apiKey}&timestamp=${timestamp}&sign=${sign}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code,
                    partner_id: Number(connection.apiKey),
                    shop_id,
                }),
            }
        );

        const tokenData = await tokenResponse.json() as {
            access_token?: string;
            refresh_token?: string;
            expires_in?: number;
        };

        if (!tokenData.access_token) {
            return res.status(400).json({ error: "Failed to get access token" });
        }

        connection.accessToken = tokenData.access_token;
        connection.refreshToken = tokenData.refresh_token;
        connection.userId = String(shop_id);
        connection.isConnected = true;
        connection.tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 86400) * 1000);

        await connectionRepo().save(connection);
        res.json({ success: true, isConnected: true });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Shopee OAuth failed";
        res.status(500).json({ error: errorMessage });
    }
});

// Delete connection
router.delete("/:marketplace", validateParams(marketplaceParamSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        await connectionRepo().delete({ marketplace: req.params.marketplace });
        res.json({ success: true });
    } catch (error) {
        next(new ValidationError("Failed to delete connection"));
    }
});

// Get token status for a connection
router.get("/:marketplace/token-status", validateParams(marketplaceParamSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const connection = await connectionRepo().findOneBy({ marketplace: req.params.marketplace });
        if (!connection) {
            return res.json({ hasToken: false, isValid: false });
        }

        const hasToken = !!connection.refreshToken || !!connection.accessToken;
        const isValid = connection.isConnected === true;
        const expiresAt = connection.tokenExpiresAt?.toISOString();

        res.json({ hasToken, isValid, expiresAt });
    } catch (error) {
        next(new ValidationError("Failed to check token status"));
    }
});

export default router;
