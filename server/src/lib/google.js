const { jwtVerify } = require('jose');
const { jwksService } = require('./jwks');

class GoogleAuthService {
  constructor() {
    this.GOOGLE_ISSUER = 'https://accounts.google.com';
    
    const iosClientId = process.env.GOOGLE_CLIENT_ID_IOS;
    const androidClientId = process.env.GOOGLE_CLIENT_ID_ANDROID;

    this.allowedAudiences = [iosClientId, androidClientId].filter(Boolean);

    if (this.allowedAudiences.length === 0) {
      console.warn('No Google client IDs configured. Google Sign-In will not work.');
    }
  }

  /**
   * Verify Google ID token
   */
  async verifyIdToken(idToken) {
    if (this.allowedAudiences.length === 0) {
      throw new Error('Google Sign-In not configured');
    }

    try {
      const jwks = jwksService.getGoogleJWKS();

      // Verify the token
      const { payload } = await jwtVerify(idToken, jwks, {
        issuer: this.GOOGLE_ISSUER,
        audience: this.allowedAudiences,
      });

      const googlePayload = payload;

      // Additional validation
      if (!googlePayload.sub) {
        throw new Error('Invalid token: missing subject');
      }

      if (!googlePayload.email_verified) {
        throw new Error('Email not verified');
      }

      return googlePayload;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Google token verification failed: ${error.message}`);
      }
      throw new Error('Google token verification failed: Unknown error');
    }
  }

  /**
   * Extract user info from verified token
   */
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

  /**
   * Check if Google Sign-In is configured
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
      // Don't expose actual client IDs for security
    };
  }
}

// Singleton instance
const googleAuthService = new GoogleAuthService();

module.exports = { googleAuthService };