import "reflect-metadata";
import express from "express";
import cors from "cors";

import { AppDataSource } from "./data-source";
import connectionsRouter from "./routes/connections";
import productsRouter from "./routes/products";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/connections", connectionsRouter);
app.use("/api/products", productsRouter);

app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "Back-end is running!" });
});

const MAX_RETRIES = 10;
const RETRY_DELAY = 5000;

const initializeDatabase = async (attempts = 1) => {
    try {
        await AppDataSource.initialize();
        console.log("Data Source has been initialized!");
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (err) {
        console.error(`Error during Data Source initialization (Attempt ${attempts}/${MAX_RETRIES}):`, err);
        if (attempts < MAX_RETRIES) {
            console.log(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
            setTimeout(() => initializeDatabase(attempts + 1), RETRY_DELAY);
        } else {
            console.error("Max retries reached. Exiting.");
            process.exit(1);
        }
    }
};

initializeDatabase();
