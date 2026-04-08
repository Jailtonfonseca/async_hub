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
    .filter(origin => {
        // Strict URL validation - prevent DNS rebinding attacks
        try {
            const url = new URL(origin);
            // Only allow http or https
            if (!['http:', 'https:'].includes(url.protocol)) return false;
            // Prevent IP addresses except localhost
            if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname)) {
                return url.hostname === '127.0.0.1';
            }
            // Prevent double domains (e.g., evil.com.attacker.com)
            const parts = url.hostname.split('.');
            if (parts.length > 3) return false;
            return true;
        } catch {
            return false;
        }
    });

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
    skip: (req) => req.path.startsWith('/webhooks'), // Skip rate limiting for webhooks
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
            console.warn(`CORS blocked request from: ${origin}`);
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining"], // Expose rate limit headers
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

// Global Error Handler - Must be last middleware
app.use(errorHandler);

// 404 handler for unknown routes
app.use((req: Request, res: Response) => {
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
const gracefulShutdown = (signal: string) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(() => {
        console.log('HTTP server closed');
        
        // Close database connection
        AppDataSource.destroy()
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
