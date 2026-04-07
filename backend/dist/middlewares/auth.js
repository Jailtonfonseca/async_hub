"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitHandler = exports.optionalAuth = void 0;
/**
 * Optional authentication middleware for API routes
 * In production, implement proper JWT or API key validation
 */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        // TODO: Implement proper JWT validation
        // For now, just extract the token for logging purposes
        console.log("[Auth] Token received:", token.substring(0, 10) + "...");
        // In production, validate token and set req.userId
        // const decoded = verifyToken(token);
        // req.userId = decoded.userId;
    }
    next();
};
exports.optionalAuth = optionalAuth;
/**
 * Rate limit exceeded handler
 */
const rateLimitHandler = (req, res, next) => {
    res.status(429).json({
        error: "Too many requests",
        message: "Please try again later",
        retryAfter: res.getHeader("Retry-After")
    });
};
exports.rateLimitHandler = rateLimitHandler;
