"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwksService = void 0;
const jose_1 = require("jose");
class JWKSService {
    cache = {};
    CACHE_TTL = 3600000;
    getJWKS(url) {
        const now = Date.now();
        const cached = this.cache[url];
        if (cached && (now - cached.lastFetched) < this.CACHE_TTL) {
            return cached.jwks;
        }
        const jwks = (0, jose_1.createRemoteJWKSet)(new URL(url), {
            cooldownDuration: 30000,
            cacheMaxAge: this.CACHE_TTL,
        });
        this.cache[url] = {
            jwks,
            lastFetched: now,
        };
        return jwks;
    }
    clearCache(url) {
        if (url) {
            delete this.cache[url];
        }
        else {
            this.cache = {};
        }
    }
    getGoogleJWKS() {
        return this.getJWKS('https://www.googleapis.com/oauth2/v3/certs');
    }
    getAppleJWKS() {
        return this.getJWKS('https://appleid.apple.com/auth/keys');
    }
}
exports.jwksService = new JWKSService();
