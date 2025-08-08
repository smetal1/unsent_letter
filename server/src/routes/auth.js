const { Router } = require('express');
const { z } = require('zod');
const { jwtService } = require('../lib/jwt');
const { googleAuthService } = require('../lib/google');
const { appleAuthService } = require('../lib/apple');

const router = Router();

// Validation schemas
const tokenExchangeSchema = z.object({
  provider: z.enum(['google', 'apple']),
  idToken: z.string().min(1, 'ID token is required'),
});

/**
 * POST /v1/auth/exchange
 * Exchange provider ID token for server JWT
 */
router.post('/exchange', async (req, res) => {
  try {
    // Validate request body
    const { provider, idToken } = tokenExchangeSchema.parse(req.body);

    let userId;
    let userInfo = {};

    // Verify ID token based on provider
    switch (provider) {
      case 'google': {
        if (!googleAuthService.isConfigured()) {
          res.status(400).json({
            error: 'Google Sign-In not configured',
            code: 'GOOGLE_NOT_CONFIGURED'
          });
          return;
        }

        const googlePayload = await googleAuthService.verifyIdToken(idToken);
        userInfo = googleAuthService.extractUserInfo(googlePayload);
        userId = userInfo.userId;
        break;
      }

      case 'apple': {
        if (!appleAuthService.isConfigured()) {
          res.status(400).json({
            error: 'Apple Sign-In not configured',
            code: 'APPLE_NOT_CONFIGURED'
          });
          return;
        }

        const applePayload = await appleAuthService.verifyIdToken(idToken);
        userInfo = appleAuthService.extractUserInfo(applePayload);
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

    // Generate server JWT
    const serverJWT = await jwtService.signServerJWT({
      sub: userId,
      provider: provider,
    });

    const expirationInfo = jwtService.getExpirationInfo();

    // Log successful authentication (no PII)
    console.info('Token exchange successful:', {
      provider,
      userId: userId.substring(0, 8) + '...', // Partial ID for debugging
      timestamp: new Date().toISOString(),
      ip: req.ip,
    });

    res.json({
      token: serverJWT,
      expiresIn: expirationInfo.expiresIn,
      provider: provider,
    });

  } catch (error) {
    // Log error (no sensitive data)
    console.error('Token exchange failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: req.body?.provider,
      timestamp: new Date().toISOString(),
      ip: req.ip,
    });

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
      return;
    }

    if (error instanceof Error) {
      // Don't expose internal error details to client
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

/**
 * GET /.well-known/jwks.json
 * Expose server's public keys for JWT verification (optional)
 */
router.get('/.well-known/jwks.json', async (req, res) => {
  try {
    const jwk = await jwtService.generateJWK();
    
    res.json({
      keys: [jwk]
    });
  } catch (error) {
    console.error('JWKS generation failed:', error);
    
    res.status(500).json({
      error: 'Failed to generate JWKS',
      code: 'JWKS_ERROR'
    });
  }
});

/**
 * GET /v1/auth/providers
 * Get available authentication providers
 */
router.get('/providers', (req, res) => {
  res.json({
    google: googleAuthService.getPublicConfig(),
    apple: appleAuthService.getPublicConfig(),
  });
});

module.exports = router;