const { jwtVerify } = require('jose');
const { jwksService } = require('./jwks');

class AppleAuthService {
  constructor() {
    this.APPLE_ISSUER = 'https://appleid.apple.com';
    
    const bundleId = process.env.APPLE_AUDIENCE_BUNDLE_ID;
    const serviceId = process.env.APPLE_AUDIENCE_SERVICE_ID;

    this.allowedAudiences = [bundleId, serviceId].filter(Boolean);

    if (this.allowedAudiences.length === 0) {
      console.warn('No Apple audience IDs configured. Apple Sign-In will not work.');
    }
  }

  /**
   * Verify Apple ID token
   */
  async verifyIdToken(idToken) {
    if (this.allowedAudiences.length === 0) {
      throw new Error('Apple Sign-In not configured');
    }

    try {
      const jwks = jwksService.getAppleJWKS();

      // Verify the token
      const { payload } = await jwtVerify(idToken, jwks, {
        issuer: this.APPLE_ISSUER,
        audience: this.allowedAudiences,
      });

      const applePayload = payload;

      // Additional validation
      if (!applePayload.sub) {
        throw new Error('Invalid token: missing subject');
      }

      // Apple's email_verified can be boolean or string "true"/"false"
      if (applePayload.email && !this.isEmailVerified(applePayload.email_verified)) {
        throw new Error('Email not verified');
      }

      return applePayload;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Apple token verification failed: ${error.message}`);
      }
      throw new Error('Apple token verification failed: Unknown error');
    }
  }

  /**
   * Extract user info from verified token
   */
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

  /**
   * Check if Apple Sign-In is configured
   */
  isConfigured() {
    return this.allowedAudiences.length > 0;
  }

  /**
   * Get configuration info (for public endpoint)
   */
  getPublicConfig() {
    return {
      enabled: this.isConfigured(),
    };
  }

  /**
   * Helper to check email verification status
   */
  isEmailVerified(emailVerified) {
    if (typeof emailVerified === 'boolean') {
      return emailVerified;
    }
    if (typeof emailVerified === 'string') {
      return emailVerified.toLowerCase() === 'true';
    }
    // If email_verified is not present, assume true for Apple
    // (Apple typically only includes verified emails)
    return true;
  }
}

// Singleton instance
const appleAuthService = new AppleAuthService();

module.exports = { appleAuthService };