import { Request, Response, NextFunction } from "express";

interface ApiError extends Error {
    status?: number;
    code?: string;
    details?: any;
}

export const errorHandler = (err: ApiError, req: Request, res: Response, next: NextFunction) => {
    // Log error with timestamp and request info
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ${req.method} ${req.path} - ${err.message}`);
    
    // Default values
    let status = err.status || 500;
    let message = err.message || "Internal Server Error";
    let code = err.code || "INTERNAL_ERROR";
    
    // Ensure status code is valid
    if (status < 400 || status > 599) {
        status = 500;
    }
    
    // Don't expose internal errors in production
    if (process.env.NODE_ENV === "production" && status === 500) {
        message = "An unexpected error occurred";
    }
    
    res.status(status).json({
        success: false,
        error: {
            code,
            message,
            details: process.env.NODE_ENV === "development" ? err.details : undefined,
        },
        timestamp,
    });
};

// Custom error classes for common scenarios
export class AppError extends Error implements ApiError {
    status: number;
    code: string;
    details?: any;

    constructor(message: string, status: number = 400, code: string = "BAD_REQUEST", details?: any) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string = "Resource") {
        super(`${resource} not found`, 404, "NOT_FOUND");
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: any) {
        super(message, 400, "VALIDATION_ERROR", details);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = "Unauthorized") {
        super(message, 401, "UNAUTHORIZED");
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = "Forbidden") {
        super(message, 403, "FORBIDDEN");
    }
}
