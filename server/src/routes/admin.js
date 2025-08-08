const { Router } = require('express');
const path = require('path');
const { openaiProvider } = require('../providers/openai');
const { anthropicProvider } = require('../providers/anthropic');
const { localProvider } = require('../providers/local');
const { googleAuthService } = require('../lib/google');
const { appleAuthService } = require('../lib/apple');
const { jwtService } = require('../lib/jwt');

const router = Router();

// Track server start time for uptime calculation
const startTime = Date.now();

/**
 * GET /admin
 * Serve the admin status page
 */
router.get('/', (req, res) => {
  const adminPath = path.join(__dirname, '../../public/admin.html');
  res.sendFile(adminPath);
});

/**
 * GET /v1/health
 * Health check endpoint
 */
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

/**
 * GET /v1/config/public
 * Public configuration endpoint (no sensitive data)
 */
router.get('/v1/config/public', (req, res) => {
  const rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
  const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);
  const maxLetterChars = parseInt(process.env.MAX_LETTER_CHARS || '6000', 10);
  const corsOrigins = process.env.ALLOW_ORIGINS || '';

  res.json({
    auth: {
      issuer: process.env.JWT_ISSUER || 'https://unsent-letters.example',
      audience: process.env.JWT_AUDIENCE || 'unsent-letters-mobile',
      expiresIn: jwtService.getExpirationInfo().expiresIn,
    },
    ai: {
      openai: openaiProvider.getConfig(),
      anthropic: anthropicProvider.getConfig(),
      local: localProvider.getConfig(),
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
      google: googleAuthService.getPublicConfig(),
      apple: appleAuthService.getPublicConfig(),
    },
  });
});

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts = [];
  
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);

  return parts.join(' ');
}

module.exports = router;