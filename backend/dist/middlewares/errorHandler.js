"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenError = exports.UnauthorizedError = exports.ValidationError = exports.NotFoundError = exports.AppError = exports.errorHandler = void 0;
const errorHandler = (err, req, res, next) => {
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
exports.errorHandler = errorHandler;
// Custom error classes for common scenarios
class AppError extends Error {
    constructor(message, status = 400, code = "BAD_REQUEST", details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
class NotFoundError extends AppError {
    constructor(resource = "Resource") {
        super(`${resource} not found`, 404, "NOT_FOUND");
    }
}
exports.NotFoundError = NotFoundError;
class ValidationError extends AppError {
    constructor(message, details) {
        super(message, 400, "VALIDATION_ERROR", details);
    }
}
exports.ValidationError = ValidationError;
class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized") {
        super(message, 401, "UNAUTHORIZED");
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = "Forbidden") {
        super(message, 403, "FORBIDDEN");
    }
}
exports.ForbiddenError = ForbiddenError;
