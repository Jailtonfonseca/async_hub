import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { Product } from "./entities/Product";
import { Connection } from "./entities/Connection";
import { AdSuggestion } from "./entities/AdSuggestion";
import { AISettings } from "./entities/AISettings";

dotenv.config();

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "password",
    database: process.env.DB_NAME || "test",
    synchronize: process.env.TYPEORM_SYNCHRONIZE === "true",
    logging: false,
    entities: [Product, Connection, AdSuggestion, AISettings],
    migrations: [],
    subscribers: [],
});
