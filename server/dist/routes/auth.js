"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const jwt_1 = require("../lib/jwt");
const google_1 = require("../lib/google");
const apple_1 = require("../lib/apple");
const router = (0, express_1.Router)();
const tokenExchangeSchema = zod_1.z.object({
    provider: zod_1.z.enum(['google', 'apple']),
    idToken: zod_1.z.string().min(1, 'ID token is required'),
});
router.post('/exchange', async (req, res) => {
    try {
        const { provider, idToken } = tokenExchangeSchema.parse(req.body);
        let userId;
        let userInfo = {};
        switch (provider) {
            case 'google': {
                if (!google_1.googleAuthService.isConfigured()) {
                    res.status(400).json({
                        error: 'Google Sign-In not configured',
                        code: 'GOOGLE_NOT_CONFIGURED'
                    });
                    return;
                }
                const googlePayload = await google_1.googleAuthService.verifyIdToken(idToken);
                userInfo = google_1.googleAuthService.extractUserInfo(googlePayload);
                userId = userInfo.userId;
                break;
            }
            case 'apple': {
                if (!apple_1.appleAuthService.isConfigured()) {
                    res.status(400).json({
                        error: 'Apple Sign-In not configured',
                        code: 'APPLE_NOT_CONFIGURED'
                    });
                    return;
                }
                const applePayload = await apple_1.appleAuthService.verifyIdToken(idToken);
                userInfo = apple_1.appleAuthService.extractUserInfo(applePayload);
                userId = userInfo.userId;
                break;
            }
            default:
                res.status(400).json({
                    error: 'Unsupported provider',
                    code: 'UNSUPPORTED_PROVIDER'
                });
                return;
        }
        const serverJWT = await jwt_1.jwtService.signServerJWT({
            sub: userId,
            provider: provider,
        });
        const expirationInfo = jwt_1.jwtService.getExpirationInfo();
        console.info('Token exchange successful:', {
            provider,
            userId: userId.substring(0, 8) + '...',
            timestamp: new Date().toISOString(),
            ip: req.ip,
        });
        res.json({
            token: serverJWT,
            expiresIn: expirationInfo.expiresIn,
            provider: provider,
        });
    }
    catch (error) {
        console.error('Token exchange failed:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            provider: req.body?.provider,
            timestamp: new Date().toISOString(),
            ip: req.ip,
        });
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Invalid request body',
                code: 'VALIDATION_ERROR',
                details: error.errors,
            });
            return;
        }
        if (error instanceof Error) {
            if (error.message.includes('verification failed') ||
                error.message.includes('not configured')) {
                res.status(401).json({
                    error: 'Authentication failed',
                    code: 'AUTH_FAILED'
                });
                return;
            }
        }
        res.status(500).json({
            error: 'Internal server error',
            code: 'INTERNAL_ERROR'
        });
    }
});
router.get('/.well-known/jwks.json', async (req, res) => {
    try {
        const jwk = await jwt_1.jwtService.generateJWK();
        res.json({
            keys: [jwk]
        });
    }
    catch (error) {
        console.error('JWKS generation failed:', error);
        res.status(500).json({
            error: 'Failed to generate JWKS',
            code: 'JWKS_ERROR'
        });
    }
});
router.get('/providers', (req, res) => {
    res.json({
        google: google_1.googleAuthService.getPublicConfig(),
        apple: apple_1.appleAuthService.getPublicConfig(),
    });
});
exports.default = router;
