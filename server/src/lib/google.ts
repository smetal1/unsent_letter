import { jwtVerify, JWTPayload } from 'jose';
import { jwksService } from './jwks';

export interface GoogleTokenPayload extends JWTPayload {
  iss: 'https://accounts.google.com';
  aud: string;
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  iat: number;
  exp: number;
}

class GoogleAuthService {
  private readonly GOOGLE_ISSUER = 'https://accounts.google.com';
  private readonly allowedAudiences: string[];

  constructor() {
    const iosClientId = process.env.GOOGLE_CLIENT_ID_IOS;
    const androidClientId = process.env.GOOGLE_CLIENT_ID_ANDROID;

    this.allowedAudiences = [iosClientId, androidClientId].filter(Boolean) as string[];

    if (this.allowedAudiences.length === 0) {
      console.warn('No Google client IDs configured. Google Sign-In will not work.');
    }
  }

  /**
   * Verify Google ID token
   */
  async verifyIdToken(idToken: string): Promise<GoogleTokenPayload> {
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

      const googlePayload = payload as GoogleTokenPayload;

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
  extractUserInfo(payload: GoogleTokenPayload): {
    userId: string;
    email?: string;
    name?: string;
    picture?: string;
  } {
    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  }

  /**
   * Check if Google Sign-In is configured
   */
  isConfigured(): boolean {
    return this.allowedAudiences.length > 0;
  }

  /**
   * Get configuration info (for public endpoint)
   */
  getPublicConfig(): { enabled: boolean; clientIds?: string[] } {
    return {
      enabled: this.isConfigured(),
      // Don't expose actual client IDs for security
    };
  }
}

// Singleton instance
export const googleAuthService = new GoogleAuthService();