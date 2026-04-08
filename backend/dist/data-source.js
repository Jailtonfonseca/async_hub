"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const dotenv_1 = __importDefault(require("dotenv"));
const Product_1 = require("./entities/Product");
const Connection_1 = require("./entities/Connection");
const AdSuggestion_1 = require("./entities/AdSuggestion");
const AISettings_1 = require("./entities/AISettings");
dotenv_1.default.config();
// Validate required environment variables
const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME"];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(", ")}`);
    console.error("Please check your .env file");
}
exports.AppDataSource = new typeorm_1.DataSource({
    type: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "password",
    database: process.env.DB_NAME || "test",
    synchronize: process.env.NODE_ENV === "development" && process.env.TYPEORM_SYNCHRONIZE === "true",
    logging: process.env.NODE_ENV === "development",
    entities: [Product_1.Product, Connection_1.Connection, AdSuggestion_1.AdSuggestion, AISettings_1.AISettings],
    migrations: ["src/migrations/*.ts"],
    subscribers: [],
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});
