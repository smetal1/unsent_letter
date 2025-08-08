"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authOptional = void 0;
const jwt_1 = require("../lib/jwt");
const authOptional = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            next();
            return;
        }
        const token = authHeader.substring(7);
        if (!token) {
            next();
            return;
        }
        try {
            const payload = await jwt_1.jwtService.verifyServerJWT(token);
            const userContext = jwt_1.jwtService.extractUserContext(payload);
            req.user = userContext;
        }
        catch (error) {
            console.warn('Optional auth failed:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
                ip: req.ip,
            });
        }
        next();
    }
    catch (error) {
        console.error('Unexpected error in authOptional middleware:', error);
        next();
    }
};
exports.authOptional = authOptional;
