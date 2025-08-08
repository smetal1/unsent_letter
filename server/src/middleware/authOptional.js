const { jwtService } = require('../lib/jwt');

/**
 * Middleware that optionally authenticates requests
 * Attaches user context if valid token is present, otherwise continues without auth
 */
const authOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // No auth header - continue without authentication
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // No token - continue without authentication
    if (!token) {
      next();
      return;
    }

    // Try to verify the JWT token
    try {
      const payload = await jwtService.verifyServerJWT(token);
      const userContext = jwtService.extractUserContext(payload);

      // Attach user context to request
      req.user = userContext;
    } catch (error) {
      // Token verification failed - log but continue without auth
      console.warn('Optional auth failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        ip: req.ip,
      });
    }

    next();
  } catch (error) {
    // Unexpected error - log and continue without auth
    console.error('Unexpected error in authOptional middleware:', error);
    next();
  }
};

module.exports = { authOptional };