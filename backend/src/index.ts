import "reflect-metadata";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { AppDataSource } from "./data-source";
import connectionsRouter from "./routes/connections";
import productsRouter from "./routes/products";
import webhooksRouter from "./routes/webhooks";
import aiRouter from "./routes/ai";
import { tokenRefreshService } from "./services/TokenRefreshService";
import { syncScheduler } from "./services/SyncScheduler";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();
const port = process.env.PORT || 4000;

// Security: Use environment variable with strict validation
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean)
    .filter(origin => /^https?:\/\/[\w\-.]+(:\d+)?$/.test(origin)); // Validate URL format

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for API
    crossOriginEmbedderPolicy: false,
}));

// Rate limiting for API endpoints (excluding webhooks)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: "Too many requests, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use("/api", apiLimiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Too many authentication attempts" },
});

app.use("/api/connections", authLimiter);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "10mb" })); // Limit body size

// Track database status
let dbConnected = false;

// API Routes
app.use("/api/connections", connectionsRouter);
app.use("/api/products", productsRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/ai", aiRouter);

app.get("/health", (_req: Request, res: Response) => {
    const syncStatus = syncScheduler.getStatus();
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
app.post("/api/tokens/refresh/:marketplace", async (req: Request, res: Response) => {
    const { marketplace } = req.params;
    const result = await tokenRefreshService.forceRefresh(marketplace);
    res.json(result);
});

app.get("/api/tokens/status/:marketplace", async (req: Request, res: Response) => {
    const { marketplace } = req.params;
    const status = await tokenRefreshService.getTokenStatus(marketplace);
    res.json(status);
});

// Sync scheduler endpoints
app.get("/api/sync/status", (_req: Request, res: Response) => {
    res.json(syncScheduler.getStatus());
});

app.get("/api/sync/history", (req: Request, res: Response) => {
    const limit = parseInt(String(req.query.limit || "10"), 10) || 10;
    res.json(syncScheduler.getHistory(limit));
});

app.post("/api/sync/trigger", async (_req: Request, res: Response) => {
    const results = await syncScheduler.runFullSync();
    res.json({ success: true, results });
});

app.post("/api/sync/trigger/:marketplace", async (req: Request, res: Response) => {
    const { marketplace } = req.params;
    const result = await syncScheduler.triggerSync(marketplace);
    if (result) {
        res.json({ success: true, result });
    } else {
        res.status(404).json({ success: false, error: "Marketplace not connected" });
    }
});

app.post("/api/sync/interval", (req: Request, res: Response) => {
    const minutes = Number(req.body?.minutes);
    if (Number.isFinite(minutes) && minutes >= 1) {
        syncScheduler.setInterval(minutes);
        res.json({ success: true, intervalMinutes: minutes });
    } else {
        res.status(400).json({ success: false, error: "Invalid interval (min: 1 minute)" });
    }
});

// Global Error Handler
app.use(errorHandler);

// Start server IMMEDIATELY
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Connect to database in background
const MAX_RETRIES = 10;
const RETRY_DELAY = 5000;

const initializeDatabase = async (attempts = 1): Promise<void> => {
    try {
        await AppDataSource.initialize();
        dbConnected = true;
        console.log("Data Source has been initialized!");

        // Start services after DB is ready
        tokenRefreshService.start();
        syncScheduler.start(15); // Sync every 15 minutes
    } catch (err) {
        console.error(`Error during Data Source initialization (Attempt ${attempts}/${MAX_RETRIES}):`, err);
        if (attempts < MAX_RETRIES) {
            console.log(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
            setTimeout(() => initializeDatabase(attempts + 1), RETRY_DELAY);
        } else {
            console.error("Max retries reached. Database will remain disconnected.");
        }
    }
};

initializeDatabase();
