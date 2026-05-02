import { Request, Response, NextFunction } from "express";
import { z, ZodSchema, ZodError } from "zod";
import { ValidationError } from "../middlewares/errorHandler";

type ValidationTarget = "body" | "query" | "params";

interface ValidateOptions {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}

/**
 * Middleware factory para validação com Zod
 */
export function validate(schemas: ValidateOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Validate body
            if (schemas.body) {
                req.body = await schemas.body.parseAsync(req.body) as any;
            }

            // Validate query
            if (schemas.query) {
                req.query = await schemas.query.parseAsync(req.query) as any;
            }

            // Validate params
            if (schemas.params) {
                req.params = await schemas.params.parseAsync(req.params) as any;
            }

            next();
        } catch (error: unknown) {
            // ZodError v3 uses `.issues`, some versions use `.errors`
            const zodError = error as any;
            if (zodError?.issues && Array.isArray(zodError.issues)) {
                const details = zodError.issues.map((err: any) => ({
                    field: err.path?.join(".") || "",
                    message: err.message || "Erro de validação",
                    code: err.code || "invalid",
                }));
                next(new ValidationError("Dados inválidos", details));
            } else if (zodError?.errors && Array.isArray(zodError.errors)) {
                const details = zodError.errors.map((err: any) => ({
                    field: err.path?.join(".") || "",
                    message: err.message || "Erro de validação",
                    code: err.code || "invalid",
                }));
                next(new ValidationError("Dados inválidos", details));
            } else {
                next(error);
            }
        }
    };
}

/**
 * Validate request body only
 */
export function validateBody<T extends ZodSchema>(schema: T) {
    return validate({ body: schema });
}

/**
 * Validate query parameters only
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
    return validate({ query: schema });
}

/**
 * Validate route parameters only
 */
export function validateParams<T extends ZodSchema>(schema: T) {
    return validate({ params: schema });
}

/**
 * Validate multiple parts of the request
 */
export function validateRequest(options: ValidateOptions) {
    return validate(options);
}
