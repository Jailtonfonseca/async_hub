import { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
    userId?: string;
    marketplace?: string;
}

/**
 * Optional authentication middleware for API routes
 * In production, implement proper JWT or API key validation
 */
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
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

/**
 * Rate limit exceeded handler
 */
export const rateLimitHandler = (req: Request, res: Response, next: NextFunction) => {
    res.status(429).json({
        error: "Too many requests",
        message: "Please try again later",
        retryAfter: res.getHeader("Retry-After")
    });
};
