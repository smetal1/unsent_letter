"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRequired = void 0;
const jwt_1 = require("../lib/jwt");
const authRequired = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({
                error: 'Authorization header required',
                code: 'MISSING_AUTH_HEADER'
            });
            return;
        }
        if (!authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                error: 'Invalid authorization header format. Expected: Bearer <token>',
                code: 'INVALID_AUTH_FORMAT'
            });
            return;
        }
        const token = authHeader.substring(7);
        if (!token) {
            res.status(401).json({
                error: 'Token required',
                code: 'MISSING_TOKEN'
            });
            return;
        }
        const payload = await jwt_1.jwtService.verifyServerJWT(token);
        const userContext = jwt_1.jwtService.extractUserContext(payload);
        req.user = userContext;
        next();
    }
    catch (error) {
        console.error('Auth verification failed:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            ip: req.ip,
            userAgent: req.get('User-Agent'),
        });
        res.status(401).json({
            error: 'Invalid or expired token',
            code: 'INVALID_TOKEN'
        });
    }
};
exports.authRequired = authRequired;
