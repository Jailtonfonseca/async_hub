import "reflect-metadata";
import express from "express";
import cors from "cors";

import { AppDataSource } from "./data-source";
import connectionsRouter from "./routes/connections";
import productsRouter from "./routes/products";
import webhooksRouter from "./routes/webhooks";
import { tokenRefreshService } from "./services/TokenRefreshService";
import { syncScheduler } from "./services/SyncScheduler";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Track database status
let dbConnected = false;

// API Routes
app.use("/api/connections", connectionsRouter);
app.use("/api/products", productsRouter);
app.use("/api/webhooks", webhooksRouter);

app.get("/health", (req: any, res: any) => {
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
app.post("/api/tokens/refresh/:marketplace", async (req: any, res: any) => {
    const { marketplace } = req.params;
    const result = await tokenRefreshService.forceRefresh(marketplace);
    res.json(result);
});

app.get("/api/tokens/status/:marketplace", async (req: any, res: any) => {
    const { marketplace } = req.params;
    const status = await tokenRefreshService.getTokenStatus(marketplace);
    res.json(status);
});

// Sync scheduler endpoints
app.get("/api/sync/status", (req: any, res: any) => {
    res.json(syncScheduler.getStatus());
});

app.get("/api/sync/history", (req: any, res: any) => {
    const limit = parseInt(req.query.limit) || 10;
    res.json(syncScheduler.getHistory(limit));
});

app.post("/api/sync/trigger", async (req: any, res: any) => {
    const results = await syncScheduler.runFullSync();
    res.json({ success: true, results });
});

app.post("/api/sync/trigger/:marketplace", async (req: any, res: any) => {
    const { marketplace } = req.params;
    const result = await syncScheduler.triggerSync(marketplace);
    if (result) {
        res.json({ success: true, result });
    } else {
        res.status(404).json({ success: false, error: "Marketplace not connected" });
    }
});

app.post("/api/sync/interval", (req: any, res: any) => {
    const { minutes } = req.body;
    if (minutes && minutes >= 1) {
        syncScheduler.setInterval(minutes);
        res.json({ success: true, intervalMinutes: minutes });
    } else {
        res.status(400).json({ success: false, error: "Invalid interval (min: 1 minute)" });
    }
});

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



