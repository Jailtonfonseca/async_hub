import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AppDataSource } from '../data-source';
import { Connection } from '../entities/Connection';

describe('Connection Entity', () => {
  beforeAll(async () => {
    // Initialize test database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  afterAll(async () => {
    // Close connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it('should create a new connection', async () => {
    const repo = AppDataSource.getRepository(Connection);
    
    const connection = new Connection();
    connection.marketplace = 'woocommerce';
    connection.apiUrl = 'https://example.com';
    connection.apiKey = 'test-key';
    connection.apiSecret = 'test-secret';
    connection.isConnected = false;

    const saved = await repo.save(connection);
    
    expect(saved.id).toBeDefined();
    expect(saved.marketplace).toBe('woocommerce');
    expect(saved.apiUrl).toBe('https://example.com');
    
    // Cleanup
    await repo.delete(saved.id);
  });

  it('should find connection by marketplace', async () => {
    const repo = AppDataSource.getRepository(Connection);
    
    // Create test connection
    const connection = new Connection();
    connection.marketplace = 'mercadolibre';
    connection.isConnected = false;
    const saved = await repo.save(connection);
    
    // Find it
    const found = await repo.findOneBy({ marketplace: 'mercadolibre' });
    expect(found).toBeDefined();
    expect(found?.id).toBe(saved.id);
    
    // Cleanup
    await repo.delete(saved.id);
  });
});
