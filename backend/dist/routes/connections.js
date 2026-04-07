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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const data_source_1 = require("../data-source");
const Connection_1 = require("../entities/Connection");
const WooCommerceAdapter_1 = require("../adapters/WooCommerceAdapter");
const MercadoLibreAdapter_1 = require("../adapters/MercadoLibreAdapter");
const AmazonAdapter_1 = require("../adapters/AmazonAdapter");
const router = (0, express_1.Router)();
const connectionRepo = () => data_source_1.AppDataSource.getRepository(Connection_1.Connection);
// Get all connections
router.get("/", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const connections = yield connectionRepo().find();
        // Hide sensitive data
        const safeConnections = connections.map(c => ({
            id: c.id,
            marketplace: c.marketplace,
            isConnected: c.isConnected,
            apiUrl: c.apiUrl,
            updatedAt: c.updatedAt,
        }));
        res.json(safeConnections);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch connections" });
    }
}));
// Get single connection
router.get("/:marketplace", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const connection = yield connectionRepo().findOneBy({ marketplace: req.params.marketplace });
        if (!connection) {
            return res.status(404).json({ error: "Connection not found" });
        }
        res.json({
            id: connection.id,
            marketplace: connection.marketplace,
            isConnected: connection.isConnected,
            apiUrl: connection.apiUrl,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch connection" });
    }
}));
// Create or Update WooCommerce connection
router.post("/woocommerce", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { apiUrl, apiKey, apiSecret } = req.body;
        let connection = yield connectionRepo().findOneBy({ marketplace: "woocommerce" });
        if (!connection) {
            connection = new Connection_1.Connection();
            connection.marketplace = "woocommerce";
        }
        connection.apiUrl = apiUrl;
        connection.apiKey = apiKey;
        connection.apiSecret = apiSecret;
        // Test connection
        const adapter = new WooCommerceAdapter_1.WooCommerceAdapter({
            apiUrl,
            apiKey,
            apiSecret,
        });
        connection.isConnected = yield adapter.testConnection();
        yield connectionRepo().save(connection);
        res.json({ success: true, isConnected: connection.isConnected });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to save connection" });
    }
}));
// Create or Update MercadoLibre connection (save credentials)
router.post("/mercadolibre", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { apiKey, apiSecret } = req.body; // App ID and Secret
        let connection = yield connectionRepo().findOneBy({ marketplace: "mercadolibre" });
        if (!connection) {
            connection = new Connection_1.Connection();
            connection.marketplace = "mercadolibre";
        }
        connection.apiKey = apiKey;
        connection.apiSecret = apiSecret;
        connection.isConnected = false;
        yield connectionRepo().save(connection);
        res.json({ success: true, message: "Credentials saved. Proceed to OAuth." });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to save connection" });
    }
}));
// Get MercadoLibre OAuth URL
router.get("/mercadolibre/auth-url", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const connection = yield connectionRepo().findOneBy({ marketplace: "mercadolibre" });
        if (!connection || !connection.apiKey) {
            return res.status(400).json({ error: "MercadoLibre App ID not configured" });
        }
        const redirectUri = req.query.redirect_uri || "http://localhost:3000/callback/mercadolibre";
        const authUrl = MercadoLibreAdapter_1.MercadoLibreAdapter.getAuthUrl(connection.apiKey, redirectUri);
        res.json({ authUrl });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to generate auth URL" });
    }
}));
// MercadoLibre OAuth Callback
router.post("/mercadolibre/callback", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { code, redirect_uri } = req.body;
        const connection = yield connectionRepo().findOneBy({ marketplace: "mercadolibre" });
        if (!connection || !connection.apiKey || !connection.apiSecret) {
            return res.status(400).json({ error: "MercadoLibre credentials not configured" });
        }
        const tokenData = yield MercadoLibreAdapter_1.MercadoLibreAdapter.exchangeCodeForToken(code, connection.apiKey, connection.apiSecret, redirect_uri);
        connection.accessToken = tokenData.access_token;
        connection.refreshToken = tokenData.refresh_token;
        connection.userId = (_a = tokenData.user_id) === null || _a === void 0 ? void 0 : _a.toString();
        connection.isConnected = true;
        connection.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        yield connectionRepo().save(connection);
        res.json({ success: true, isConnected: true });
    }
    catch (error) {
        res.status(500).json({ error: ((_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || "OAuth failed" });
    }
}));
// Test connection
router.post("/:marketplace/test", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const connection = yield connectionRepo().findOneBy({ marketplace: req.params.marketplace });
        if (!connection) {
            return res.status(404).json({ error: "Connection not found" });
        }
        let isConnected = false;
        if (req.params.marketplace === "woocommerce") {
            const adapter = new WooCommerceAdapter_1.WooCommerceAdapter({
                apiUrl: connection.apiUrl,
                apiKey: connection.apiKey,
                apiSecret: connection.apiSecret,
            });
            isConnected = yield adapter.testConnection();
        }
        else if (req.params.marketplace === "mercadolibre") {
            const adapter = new MercadoLibreAdapter_1.MercadoLibreAdapter({
                accessToken: connection.accessToken,
                userId: connection.userId,
            });
            isConnected = yield adapter.testConnection();
        }
        else if (req.params.marketplace === "amazon") {
            const adapter = new AmazonAdapter_1.AmazonAdapter({
                apiKey: connection.apiKey,
                apiSecret: connection.apiSecret,
                accessToken: connection.accessToken,
                userId: connection.userId,
                apiUrl: connection.apiUrl,
                refreshToken: connection.refreshToken,
            });
            isConnected = yield adapter.testConnection();
        }
        connection.isConnected = isConnected;
        yield connectionRepo().save(connection);
        res.json({ isConnected });
    }
    catch (error) {
        res.status(500).json({ error: "Test failed" });
    }
}));
// Create or Update Amazon connection (save credentials)
router.post("/amazon", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { apiKey, apiSecret, awsAccessKey, awsSecretKey, awsRegion } = req.body;
        let connection = yield connectionRepo().findOneBy({ marketplace: "amazon" });
        if (!connection) {
            connection = new Connection_1.Connection();
            connection.marketplace = "amazon";
        }
        connection.apiKey = apiKey; // LWA Client ID
        connection.apiSecret = apiSecret; // LWA Client Secret
        connection.accessToken = awsAccessKey; // AWS Access Key ID (reusing field)
        connection.userId = awsSecretKey; // AWS Secret Access Key (reusing field)
        connection.apiUrl = awsRegion; // AWS Region (reusing field)
        connection.isConnected = false;
        yield connectionRepo().save(connection);
        res.json({ success: true, message: "Credentials saved. Proceed to OAuth." });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to save connection" });
    }
}));
// Get Amazon OAuth URL
router.get("/amazon/auth-url", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const connection = yield connectionRepo().findOneBy({ marketplace: "amazon" });
        if (!connection || !connection.apiKey) {
            return res.status(400).json({ error: "Amazon LWA Client ID not configured" });
        }
        const redirectUri = req.query.redirect_uri || "http://localhost:3000/callback/amazon";
        const state = req.query.state;
        const authUrl = AmazonAdapter_1.AmazonAdapter.getAuthUrl(connection.apiKey, redirectUri, state);
        res.json({ authUrl });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to generate auth URL" });
    }
}));
// Amazon OAuth Callback
router.post("/amazon/callback", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { code, redirect_uri } = req.body;
        const connection = yield connectionRepo().findOneBy({ marketplace: "amazon" });
        if (!connection || !connection.apiKey || !connection.apiSecret) {
            return res.status(400).json({ error: "Amazon credentials not configured" });
        }
        const tokenData = yield AmazonAdapter_1.AmazonAdapter.exchangeCodeForToken(code, connection.apiKey, connection.apiSecret, redirect_uri);
        connection.refreshToken = tokenData.refresh_token;
        connection.isConnected = true;
        connection.tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        yield connectionRepo().save(connection);
        res.json({ success: true, isConnected: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message || "OAuth failed" });
    }
}));
// Delete connection
router.delete("/:marketplace", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield connectionRepo().delete({ marketplace: req.params.marketplace });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete connection" });
    }
}));
exports.default = router;
