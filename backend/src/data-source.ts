import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { Product } from "./entities/Product";
import { Connection } from "./entities/Connection";
import { AdSuggestion } from "./entities/AdSuggestion";
import { AISettings } from "./entities/AISettings";

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME"];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(", ")}`);
    console.error("Please check your .env file");
}

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "password",
    database: process.env.DB_NAME || "test",
    synchronize: process.env.NODE_ENV === "development" && process.env.TYPEORM_SYNCHRONIZE === "true",
    logging: process.env.NODE_ENV === "development",
    entities: [Product, Connection, AdSuggestion, AISettings],
    migrations: ["src/migrations/*.ts"],
    subscribers: [],
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});
