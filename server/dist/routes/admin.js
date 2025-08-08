"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const openai_1 = require("../providers/openai");
const anthropic_1 = require("../providers/anthropic");
const local_1 = require("../providers/local");
const google_1 = require("../lib/google");
const apple_1 = require("../lib/apple");
const jwt_1 = require("../lib/jwt");
const router = (0, express_1.Router)();
const startTime = Date.now();
router.get('/', (req, res) => {
    const adminPath = path_1.default.join(__dirname, '../../public/admin.html');
    res.sendFile(adminPath);
});
router.get('/v1/health', (req, res) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const uptimeString = formatUptime(uptime);
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: uptimeString,
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
    });
});
router.get('/v1/config/public', (req, res) => {
    const rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
    const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);
    const maxLetterChars = parseInt(process.env.MAX_LETTER_CHARS || '6000', 10);
    const corsOrigins = process.env.ALLOW_ORIGINS || '';
    res.json({
        auth: {
            issuer: process.env.JWT_ISSUER || 'https://unsent-letters.example',
            audience: process.env.JWT_AUDIENCE || 'unsent-letters-mobile',
            expiresIn: jwt_1.jwtService.getExpirationInfo().expiresIn,
        },
        ai: {
            openai: openai_1.openaiProvider.getConfig(),
            anthropic: anthropic_1.anthropicProvider.getConfig(),
            local: local_1.localProvider.getConfig(),
        },
        limits: {
            maxLetterChars,
        },
        rateLimit: {
            windowMs: rateLimitWindow,
            max: rateLimitMax,
        },
        cors: {
            origins: corsOrigins.split(',').map(origin => origin.trim()).filter(Boolean),
        },
        providers: {
            google: google_1.googleAuthService.getPublicConfig(),
            apple: apple_1.appleAuthService.getPublicConfig(),
        },
    });
});
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    const parts = [];
    if (days > 0)
        parts.push(`${days}d`);
    if (hours > 0)
        parts.push(`${hours}h`);
    if (minutes > 0)
        parts.push(`${minutes}m`);
    if (remainingSeconds > 0 || parts.length === 0)
        parts.push(`${remainingSeconds}s`);
    return parts.join(' ');
}
exports.default = router;
