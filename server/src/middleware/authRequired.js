const { jwtService } = require('../lib/jwt');

/**
 * Middleware that requires valid JWT authentication
 */
const authRequired = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'Authorization header required',
        code: 'MISSING_AUTH_HEADER'
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Invalid authorization header format. Expected: Bearer <token>',
        code: 'INVALID_AUTH_FORMAT'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      res.status(401).json({
        error: 'Token required',
        code: 'MISSING_TOKEN'
      });
      return;
    }

    // Verify the JWT token
    const payload = await jwtService.verifyServerJWT(token);
    const userContext = jwtService.extractUserContext(payload);

    // Attach user context to request
    req.user = userContext;

    next();
  } catch (error) {
    // Log error for debugging (without exposing sensitive info)
    console.error('Auth verification failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(401).json({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }
};

module.exports = { authRequired };