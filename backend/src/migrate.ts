#!/usr/bin/env node
/**
 * Script para gerar migrations do TypeORM
 * Uso: npm run migration:generate -- --name=NomeDaMigration
 */

import { DataSource } from "typeorm";
import { Product } from "./entities/Product";
import { Connection } from "./entities/Connection";
import { AdSuggestion } from "./entities/AdSuggestion";
import { AISettings } from "./entities/AISettings";
import dotenv from "dotenv";

dotenv.config();

const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "password",
    database: process.env.DB_NAME || "async_hub",
    entities: [Product, Connection, AdSuggestion, AISettings],
    migrations: ["src/migrations/*.ts"],
    synchronize: false, // Never use synchronize with migrations
    logging: true,
});

AppDataSource.initialize()
    .then(async () => {
        console.log("Data Source initialized");
        
        const args = process.argv.slice(2);
        const nameIndex = args.findIndex(arg => arg === '--name');
        const migrationName = nameIndex !== -1 ? args[nameIndex + 1] : 'Migration';
        
        console.log(`Generating migration: ${migrationName}`);
        
        await AppDataSource.runMigrations();
        console.log("Migrations completed successfully");
        
        await AppDataSource.destroy();
    })
    .catch((error) => {
        console.error("Error during Data Source initialization:", error);
        process.exit(1);
    });
