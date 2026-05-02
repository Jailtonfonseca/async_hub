import { describe, it, expect } from 'vitest';
import { validate, validateBody } from '../middlewares/validation';
import { z } from 'zod';

describe('Validation Middleware', () => {
  it('should pass valid body', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().min(18),
    });

    const req = {
      body: { name: 'John', age: 25 },
      query: {},
      params: {},
    } as any;

    const res = {} as any;
    const next = () => {};

    const middleware = validateBody(schema);
    
    // Should not throw
    expect(() => middleware(req, res, next)).not.toThrow();
  });

  it('should reject invalid body', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().min(18),
    });

    const req = {
      body: { name: 'John', age: 15 }, // Age too low
      query: {},
      params: {},
    } as any;

    const errors: any[] = [];
    const res = {
      status: (code: number) => ({
        json: (data: any) => errors.push({ code, data }),
      }),
    } as any;
    
    const next = (error: any) => {
      errors.push(error);
    };

    const middleware = validateBody(schema);
    middleware(req, res, next);
    
    // Should have validation error
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should validate query parameters', async () => {
    const schema = z.object({
      marketplace: z.enum(['woocommerce', 'mercadolibre', 'amazon']),
    });

    const req = {
      body: {},
      query: { marketplace: 'woocommerce' },
      params: {},
    } as any;

    const res = {} as any;
    const next = () => {};

    const middleware = validate({ query: schema });
    
    expect(() => middleware(req, res, next)).not.toThrow();
  });
});
