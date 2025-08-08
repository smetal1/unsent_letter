"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appleAuthService = void 0;
const jose_1 = require("jose");
const jwks_1 = require("./jwks");
class AppleAuthService {
    APPLE_ISSUER = 'https://appleid.apple.com';
    allowedAudiences;
    constructor() {
        const bundleId = process.env.APPLE_AUDIENCE_BUNDLE_ID;
        const serviceId = process.env.APPLE_AUDIENCE_SERVICE_ID;
        this.allowedAudiences = [bundleId, serviceId].filter(Boolean);
        if (this.allowedAudiences.length === 0) {
            console.warn('No Apple audience IDs configured. Apple Sign-In will not work.');
        }
    }
    async verifyIdToken(idToken) {
        if (this.allowedAudiences.length === 0) {
            throw new Error('Apple Sign-In not configured');
        }
        try {
            const jwks = jwks_1.jwksService.getAppleJWKS();
            const { payload } = await (0, jose_1.jwtVerify)(idToken, jwks, {
                issuer: this.APPLE_ISSUER,
                audience: this.allowedAudiences,
            });
            const applePayload = payload;
            if (!applePayload.sub) {
                throw new Error('Invalid token: missing subject');
            }
            if (applePayload.email && !this.isEmailVerified(applePayload.email_verified)) {
                throw new Error('Email not verified');
            }
            return applePayload;
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Apple token verification failed: ${error.message}`);
            }
            throw new Error('Apple token verification failed: Unknown error');
        }
    }
    extractUserInfo(payload) {
        let displayName;
        if (payload.name?.firstName || payload.name?.lastName) {
            displayName = [payload.name.firstName, payload.name.lastName]
                .filter(Boolean)
                .join(' ')
                .trim() || undefined;
        }
        const userInfo = {
            userId: payload.sub,
        };
        if (payload.email) {
            userInfo.email = payload.email;
        }
        if (displayName) {
            userInfo.name = displayName;
        }
        return userInfo;
    }
    isConfigured() {
        return this.allowedAudiences.length > 0;
    }
    getPublicConfig() {
        return {
            enabled: this.isConfigured(),
        };
    }
    isEmailVerified(emailVerified) {
        if (typeof emailVerified === 'boolean') {
            return emailVerified;
        }
        if (typeof emailVerified === 'string') {
            return emailVerified.toLowerCase() === 'true';
        }
        return true;
    }
}
exports.appleAuthService = new AppleAuthService();
