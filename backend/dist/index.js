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
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const data_source_1 = require("./data-source");
const connections_1 = __importDefault(require("./routes/connections"));
const products_1 = __importDefault(require("./routes/products"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const ai_1 = __importDefault(require("./routes/ai"));
const TokenRefreshService_1 = require("./services/TokenRefreshService");
const SyncScheduler_1 = require("./services/SyncScheduler");
const errorHandler_1 = require("./middlewares/errorHandler");
const app = (0, express_1.default)();
const port = process.env.PORT || 4000;
// Security: Use environment variable with strict validation
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean)
    .filter(origin => {
    // Strict URL validation - prevent DNS rebinding attacks
    try {
        const url = new URL(origin);
        // Only allow http or https
        if (!['http:', 'https:'].includes(url.protocol))
            return false;
        // Prevent IP addresses except localhost
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname)) {
            return url.hostname === '127.0.0.1';
        }
        // Prevent double domains (e.g., evil.com.attacker.com)
        const parts = url.hostname.split('.');
        if (parts.length > 3)
            return false;
        return true;
    }
    catch (_a) {
        return false;
    }
});
// Security middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable for API
    crossOriginEmbedderPolicy: false,
}));
// Rate limiting for API endpoints (excluding webhooks)
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: "Too many requests, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/webhooks'), // Skip rate limiting for webhooks
});
app.use("/api", apiLimiter);
// Stricter rate limit for auth endpoints
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Too many authentication attempts" },
});
app.use("/api/connections", authLimiter);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            console.warn(`CORS blocked request from: ${origin}`);
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining"], // Expose rate limit headers
}));
app.use(express_1.default.json({ limit: "10mb" })); // Limit body size
// Track database status
let dbConnected = false;
// API Routes
app.use("/api/connections", connections_1.default);
app.use("/api/products", products_1.default);
app.use("/api/webhooks", webhooks_1.default);
app.use("/api/ai", ai_1.default);
app.get("/health", (_req, res) => {
    const syncStatus = SyncScheduler_1.syncScheduler.getStatus();
    res.json({
        status: "ok",
        message: "Back-end is running!",
        database: dbConnected ? "connected" : "connecting...",
        tokenRefresh: "active",
        syncScheduler: {
            isRunning: syncStatus.isRunning,
            lastSync: syncStatus.lastSync,
            nextSync: syncStatus.nextSync,
            intervalMinutes: syncStatus.intervalMinutes
        }
    });
});
// Token refresh endpoints
app.post("/api/tokens/refresh/:marketplace", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { marketplace } = req.params;
    const result = yield TokenRefreshService_1.tokenRefreshService.forceRefresh(marketplace);
    res.json(result);
}));
app.get("/api/tokens/status/:marketplace", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { marketplace } = req.params;
    const status = yield TokenRefreshService_1.tokenRefreshService.getTokenStatus(marketplace);
    res.json(status);
}));
// Sync scheduler endpoints
app.get("/api/sync/status", (_req, res) => {
    res.json(SyncScheduler_1.syncScheduler.getStatus());
});
app.get("/api/sync/history", (req, res) => {
    const limit = parseInt(String(req.query.limit || "10"), 10) || 10;
    res.json(SyncScheduler_1.syncScheduler.getHistory(limit));
});
app.post("/api/sync/trigger", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const results = yield SyncScheduler_1.syncScheduler.runFullSync();
    res.json({ success: true, results });
}));
app.post("/api/sync/trigger/:marketplace", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { marketplace } = req.params;
    const result = yield SyncScheduler_1.syncScheduler.triggerSync(marketplace);
    if (result) {
        res.json({ success: true, result });
    }
    else {
        res.status(404).json({ success: false, error: "Marketplace not connected" });
    }
}));
app.post("/api/sync/interval", (req, res) => {
    var _a;
    const minutes = Number((_a = req.body) === null || _a === void 0 ? void 0 : _a.minutes);
    if (Number.isFinite(minutes) && minutes >= 1) {
        SyncScheduler_1.syncScheduler.setInterval(minutes);
        res.json({ success: true, intervalMinutes: minutes });
    }
    else {
        res.status(400).json({ success: false, error: "Invalid interval (min: 1 minute)" });
    }
});
// Global Error Handler - Must be last middleware
app.use(errorHandler_1.errorHandler);
// 404 handler for unknown routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: "NOT_FOUND",
            message: `Route ${req.method} ${req.path} not found`,
        },
        timestamp: new Date().toISOString(),
    });
});
// Start server IMMEDIATELY
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    // Stop accepting new connections
    server.close(() => {
        console.log('HTTP server closed');
        // Close database connection
        data_source_1.AppDataSource.destroy()
            .then(() => {
            console.log('Database connection closed');
            process.exit(0);
        })
            .catch((err) => {
            console.error('Error closing database:', err);
            process.exit(1);
        });
    });
    // Force shutdown after 30 seconds
    setTimeout(() => {
        console.error('Forced shutdown due to timeout');
        process.exit(1);
    }, 30000);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Connect to database in background
const MAX_RETRIES = 10;
const RETRY_DELAY = 5000;
const initializeDatabase = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (attempts = 1) {
    try {
        yield data_source_1.AppDataSource.initialize();
        dbConnected = true;
        console.log("Data Source has been initialized!");
        // Start services after DB is ready
        TokenRefreshService_1.tokenRefreshService.start();
        SyncScheduler_1.syncScheduler.start(15); // Sync every 15 minutes
    }
    catch (err) {
        console.error(`Error during Data Source initialization (Attempt ${attempts}/${MAX_RETRIES}):`, err);
        if (attempts < MAX_RETRIES) {
            console.log(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
            setTimeout(() => initializeDatabase(attempts + 1), RETRY_DELAY);
        }
        else {
            console.error("Max retries reached. Database will remain disconnected.");
        }
    }
});
initializeDatabase();
