"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtService = void 0;
const jose_1 = require("jose");
class JWTService {
    privateKey;
    issuer;
    audience;
    expiresIn;
    constructor() {
        this.privateKey = process.env.JWT_PRIVATE_KEY || '';
        this.issuer = process.env.JWT_ISSUER || 'https://unsent-letters.example';
        this.audience = process.env.JWT_AUDIENCE || 'unsent-letters-mobile';
        this.expiresIn = parseInt(process.env.JWT_EXPIRES_IN || '3600', 10);
        if (!this.privateKey) {
            throw new Error('JWT_PRIVATE_KEY environment variable is required');
        }
    }
    async signServerJWT(payload) {
        try {
            const privateKey = await this.getPrivateKey();
            const now = Math.floor(Date.now() / 1000);
            const jwt = await new jose_1.SignJWT({
                sub: payload.sub,
                provider: payload.provider,
            })
                .setProtectedHeader({ alg: 'RS256' })
                .setIssuedAt(now)
                .setExpirationTime(now + this.expiresIn)
                .setIssuer(this.issuer)
                .setAudience(this.audience)
                .sign(privateKey);
            return jwt;
        }
        catch (error) {
            throw new Error(`Failed to sign JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async verifyServerJWT(token) {
        try {
            const privateKey = await this.getPrivateKey();
            const publicKey = await this.getPublicKeyFromPrivate(privateKey);
            const { payload } = await (0, jose_1.jwtVerify)(token, publicKey, {
                issuer: this.issuer,
                audience: this.audience,
            });
            return payload;
        }
        catch (error) {
            throw new Error(`Invalid JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    extractUserContext(payload) {
        return {
            userId: payload.sub,
            provider: payload.provider,
        };
    }
    getExpirationInfo() {
        return { expiresIn: this.expiresIn };
    }
    async generateJWK() {
        try {
            const privateKey = await this.getPrivateKey();
            const publicKey = await this.getPublicKeyFromPrivate(privateKey);
            const jwk = await this.cryptoKeyToJWK(publicKey);
            return {
                ...jwk,
                use: 'sig',
                alg: 'RS256',
                kid: 'unsent-letters-server-key',
            };
        }
        catch (error) {
            throw new Error(`Failed to generate JWK: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getPrivateKey() {
        try {
            const pemKey = this.privateKey
                .replace(/\\n/g, '\n')
                .replace('-----BEGIN PRIVATE KEY-----', '')
                .replace('-----END PRIVATE KEY-----', '')
                .replace(/\n/g, '')
                .replace(/\r/g, '')
                .trim();
            const binaryKey = Buffer.from(pemKey, 'base64');
            return await crypto.subtle.importKey('pkcs8', binaryKey, {
                name: 'RSASSA-PKCS1-v1_5',
                hash: 'SHA-256',
            }, true, ['sign']);
        }
        catch (error) {
            throw new Error(`Invalid private key format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getPublicKeyFromPrivate(privateKey) {
        try {
            const exported = await crypto.subtle.exportKey('jwk', privateKey);
            if (!exported.kty || !exported.n || !exported.e) {
                throw new Error('Invalid key format: missing required JWK properties');
            }
            const publicJwk = {
                kty: exported.kty,
                n: exported.n,
                e: exported.e,
                alg: 'RS256',
                use: 'sig',
            };
            return await crypto.subtle.importKey('jwk', publicJwk, {
                name: 'RSASSA-PKCS1-v1_5',
                hash: 'SHA-256',
            }, true, ['verify']);
        }
        catch (error) {
            throw new Error(`Failed to derive public key: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async cryptoKeyToJWK(key) {
        return await crypto.subtle.exportKey('jwk', key);
    }
}
exports.jwtService = new JWTService();
