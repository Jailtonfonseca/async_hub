import { Router, Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Connection } from "../entities/Connection";
import { WooCommerceAdapter } from "../adapters/WooCommerceAdapter";
import { MercadoLibreAdapter } from "../adapters/MercadoLibreAdapter";
import { AmazonAdapter } from "../adapters/AmazonAdapter";

const router = Router();
const connectionRepo = () => AppDataSource.getRepository(Connection);

// Get all connections
router.get("/", async (_req: Request, res: Response) => {
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
        res.status(500).json({ error: "Failed to fetch connections" });
    }
});

// Get single connection
router.get("/:marketplace", async (req: Request, res: Response) => {
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
        res.status(500).json({ error: "Failed to fetch connection" });
    }
});

// Create or Update WooCommerce connection
router.post("/woocommerce", async (req: Request, res: Response) => {
    try {
        const { apiUrl, apiKey, apiSecret } = req.body;

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
        res.status(500).json({ error: "Failed to save connection" });
    }
});

// Create or Update MercadoLibre connection (save credentials)
router.post("/mercadolibre", async (req: Request, res: Response) => {
    try {
        const { apiKey, apiSecret } = req.body; // App ID and Secret

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
        res.status(500).json({ error: "Failed to save connection" });
    }
});

// Get MercadoLibre OAuth URL
router.get("/mercadolibre/auth-url", async (req: Request, res: Response) => {
    try {
        const connection = await connectionRepo().findOneBy({ marketplace: "mercadolibre" });
        if (!connection || !connection.apiKey) {
            return res.status(400).json({ error: "MercadoLibre App ID not configured" });
        }

        const redirectUri = req.query.redirect_uri as string || "http://localhost:3000/callback/mercadolibre";
        const authUrl = MercadoLibreAdapter.getAuthUrl(connection.apiKey, redirectUri);
        res.json({ authUrl });
    } catch (error) {
        res.status(500).json({ error: "Failed to generate auth URL" });
    }
});

// MercadoLibre OAuth Callback
router.post("/mercadolibre/callback", async (req: Request, res: Response) => {
    try {
        const { code, redirect_uri } = req.body;

        const connection = await connectionRepo().findOneBy({ marketplace: "mercadolibre" });
        if (!connection || !connection.apiKey || !connection.apiSecret) {
            return res.status(400).json({ error: "MercadoLibre credentials not configured" });
        }

        const tokenData = await MercadoLibreAdapter.exchangeCodeForToken(
            code,
            connection.apiKey,
            connection.apiSecret,
            redirect_uri
        );

        connection.accessToken = tokenData.access_token;
        connection.refreshToken = tokenData.refresh_token;
        connection.userId = tokenData.user_id?.toString();
        connection.isConnected = true;
        connection.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

        await connectionRepo().save(connection);
        res.json({ success: true, isConnected: true });
    } catch (error: any) {
        res.status(500).json({ error: error.response?.data?.message || "OAuth failed" });
    }
});

// Test connection
router.post("/:marketplace/test", async (req: Request, res: Response) => {
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
        }

        connection.isConnected = isConnected;
        await connectionRepo().save(connection);

        res.json({ isConnected });
    } catch (error) {
        res.status(500).json({ error: "Test failed" });
    }
});

// Create or Update Amazon connection (save credentials)
router.post("/amazon", async (req: Request, res: Response) => {
    try {
        const { apiKey, apiSecret, awsAccessKey, awsSecretKey, awsRegion } = req.body;

        let connection = await connectionRepo().findOneBy({ marketplace: "amazon" });
        if (!connection) {
            connection = new Connection();
            connection.marketplace = "amazon";
        }

        connection.apiKey = apiKey; // LWA Client ID
        connection.apiSecret = apiSecret; // LWA Client Secret
        connection.accessToken = awsAccessKey; // AWS Access Key ID (reusing field)
        connection.userId = awsSecretKey; // AWS Secret Access Key (reusing field)
        connection.apiUrl = awsRegion; // AWS Region (reusing field)
        connection.isConnected = false;

        await connectionRepo().save(connection);
        res.json({ success: true, message: "Credentials saved. Proceed to OAuth." });
    } catch (error) {
        res.status(500).json({ error: "Failed to save connection" });
    }
});

// Get Amazon OAuth URL
router.get("/amazon/auth-url", async (req: Request, res: Response) => {
    try {
        const connection = await connectionRepo().findOneBy({ marketplace: "amazon" });
        if (!connection || !connection.apiKey) {
            return res.status(400).json({ error: "Amazon LWA Client ID not configured" });
        }

        const redirectUri = req.query.redirect_uri as string || "http://localhost:3000/callback/amazon";
        const state = req.query.state as string;
        const authUrl = AmazonAdapter.getAuthUrl(connection.apiKey, redirectUri, state);
        res.json({ authUrl });
    } catch (error) {
        res.status(500).json({ error: "Failed to generate auth URL" });
    }
});

// Amazon OAuth Callback
router.post("/amazon/callback", async (req: Request, res: Response) => {
    try {
        const { code, redirect_uri } = req.body;

        const connection = await connectionRepo().findOneBy({ marketplace: "amazon" });
        if (!connection || !connection.apiKey || !connection.apiSecret) {
            return res.status(400).json({ error: "Amazon credentials not configured" });
        }

        const tokenData = await AmazonAdapter.exchangeCodeForToken(
            code,
            connection.apiKey,
            connection.apiSecret,
            redirect_uri
        );

        connection.refreshToken = tokenData.refresh_token;
        connection.isConnected = true;
        connection.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

        await connectionRepo().save(connection);
        res.json({ success: true, isConnected: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "OAuth failed" });
    }
});

// Delete connection
router.delete("/:marketplace", async (req: Request, res: Response) => {
    try {
        await connectionRepo().delete({ marketplace: req.params.marketplace });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete connection" });
    }
});

export default router;
