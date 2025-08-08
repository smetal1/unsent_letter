"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleAuthService = void 0;
const jose_1 = require("jose");
const jwks_1 = require("./jwks");
class GoogleAuthService {
    GOOGLE_ISSUER = 'https://accounts.google.com';
    allowedAudiences;
    constructor() {
        const iosClientId = process.env.GOOGLE_CLIENT_ID_IOS;
        const androidClientId = process.env.GOOGLE_CLIENT_ID_ANDROID;
        this.allowedAudiences = [iosClientId, androidClientId].filter(Boolean);
        if (this.allowedAudiences.length === 0) {
            console.warn('No Google client IDs configured. Google Sign-In will not work.');
        }
    }
    async verifyIdToken(idToken) {
        if (this.allowedAudiences.length === 0) {
            throw new Error('Google Sign-In not configured');
        }
        try {
            const jwks = jwks_1.jwksService.getGoogleJWKS();
            const { payload } = await (0, jose_1.jwtVerify)(idToken, jwks, {
                issuer: this.GOOGLE_ISSUER,
                audience: this.allowedAudiences,
            });
            const googlePayload = payload;
            if (!googlePayload.sub) {
                throw new Error('Invalid token: missing subject');
            }
            if (!googlePayload.email_verified) {
                throw new Error('Email not verified');
            }
            return googlePayload;
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Google token verification failed: ${error.message}`);
            }
            throw new Error('Google token verification failed: Unknown error');
        }
    }
    extractUserInfo(payload) {
        const userInfo = {
            userId: payload.sub,
        };
        if (payload.email) {
            userInfo.email = payload.email;
        }
        if (payload.name) {
            userInfo.name = payload.name;
        }
        if (payload.picture) {
            userInfo.picture = payload.picture;
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
}
exports.googleAuthService = new GoogleAuthService();
