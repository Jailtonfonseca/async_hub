import "reflect-metadata";
import express from "express";
import cors from "cors";

import { AppDataSource } from "./data-source";
import connectionsRouter from "./routes/connections";
import productsRouter from "./routes/products";
import { tokenRefreshService } from "./services/TokenRefreshService";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Track database status
let dbConnected = false;

// API Routes
app.use("/api/connections", connectionsRouter);
app.use("/api/products", productsRouter);

app.get("/health", (req: any, res: any) => {
    res.json({
        status: "ok",
        message: "Back-end is running!",
        database: dbConnected ? "connected" : "connecting...",
        tokenRefresh: "active"
    });
});

// Token refresh endpoint
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

        // Start token refresh service after DB is ready
        tokenRefreshService.start();
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


