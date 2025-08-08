import { jwtVerify, JWTPayload } from 'jose';
import { jwksService } from './jwks';

export interface AppleTokenPayload extends JWTPayload {
  iss: 'https://appleid.apple.com';
  aud: string;
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  name?: {
    firstName?: string;
    lastName?: string;
  };
  real_user_status?: number;
  transfer_sub?: string;
  iat: number;
  exp: number;
  auth_time?: number;
  nonce_supported?: boolean;
}

class AppleAuthService {
  private readonly APPLE_ISSUER = 'https://appleid.apple.com';
  private readonly allowedAudiences: string[];

  constructor() {
    const bundleId = process.env.APPLE_AUDIENCE_BUNDLE_ID;
    const serviceId = process.env.APPLE_AUDIENCE_SERVICE_ID;

    this.allowedAudiences = [bundleId, serviceId].filter(Boolean) as string[];

    if (this.allowedAudiences.length === 0) {
      console.warn('No Apple audience IDs configured. Apple Sign-In will not work.');
    }
  }

  /**
   * Verify Apple ID token
   */
  async verifyIdToken(idToken: string): Promise<AppleTokenPayload> {
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

      const applePayload = payload as AppleTokenPayload;

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
  extractUserInfo(payload: AppleTokenPayload): {
    userId: string;
    email?: string;
    name?: string;
  } {
    let displayName: string | undefined;
    if (payload.name?.firstName || payload.name?.lastName) {
      displayName = [payload.name.firstName, payload.name.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || undefined;
    }

    return {
      userId: payload.sub,
      email: payload.email,
      name: displayName,
    };
  }

  /**
   * Check if Apple Sign-In is configured
   */
  isConfigured(): boolean {
    return this.allowedAudiences.length > 0;
  }

  /**
   * Get configuration info (for public endpoint)
   */
  getPublicConfig(): { enabled: boolean } {
    return {
      enabled: this.isConfigured(),
    };
  }

  /**
   * Helper to check email verification status
   */
  private isEmailVerified(emailVerified?: boolean | string): boolean {
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
export const appleAuthService = new AppleAuthService();