import request from 'supertest';
import app from '../src/app';
import { jwtService } from '../src/lib/jwt';

describe('POST /v1/auth/exchange', () => {
  const validGoogleIdToken = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2NzAyNzI4M2Y2ZDU5ZGQyNTQxOTIwZjQwMzY3MzBkZGZjMWY0MzQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhdWQiOiJ5b3VyLWNsaWVudC1pZC5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSIsInN1YiI6IjEyMzQ1Njc4OTAiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTYzMjc4NTIwMCwiZXhwIjoxNjMyNzg4ODAwfQ.mock-signature';

  beforeAll(() => {
    // Mock Google and Apple auth services for testing
    jest.mock('../src/lib/google', () => ({
      googleAuthService: {
        isConfigured: () => true,
        verifyIdToken: jest.fn().mockResolvedValue({
          sub: '1234567890',
          email: 'test@example.com',
          email_verified: true,
          name: 'Test User',
        }),
        extractUserInfo: jest.fn().mockReturnValue({
          userId: '1234567890',
          email: 'test@example.com',
          name: 'Test User',
        }),
      },
    }));

    jest.mock('../src/lib/apple', () => ({
      appleAuthService: {
        isConfigured: () => true,
        verifyIdToken: jest.fn().mockResolvedValue({
          sub: '0987654321',
          email: 'test@icloud.com',
          email_verified: true,
        }),
        extractUserInfo: jest.fn().mockReturnValue({
          userId: '0987654321',
          email: 'test@icloud.com',
          name: 'Apple User',
        }),
      },
    }));
  });

  describe('Valid requests', () => {
    it('should exchange Google ID token for server JWT', async () => {
      const response = await request(app)
        .post('/v1/auth/exchange')
        .send({
          provider: 'google',
          idToken: validGoogleIdToken,
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body).toHaveProperty('provider', 'google');
      expect(typeof response.body.token).toBe('string');
      expect(typeof response.body.expiresIn).toBe('number');

      // Verify the returned JWT is valid
      const payload = await jwtService.verifyServerJWT(response.body.token);
      expect(payload.sub).toBe('1234567890');
      expect(payload.provider).toBe('google');
    });

    it('should exchange Apple ID token for server JWT', async () => {
      const response = await request(app)
        .post('/v1/auth/exchange')
        .send({
          provider: 'apple',
          idToken: validGoogleIdToken, // Using same token for simplicity in test
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body).toHaveProperty('provider', 'apple');

      // Verify the returned JWT is valid
      const payload = await jwtService.verifyServerJWT(response.body.token);
      expect(payload.sub).toBe('0987654321');
      expect(payload.provider).toBe('apple');
    });
  });

  describe('Invalid requests', () => {
    it('should return 400 for missing provider', async () => {
      const response = await request(app)
        .post('/v1/auth/exchange')
        .send({
          idToken: validGoogleIdToken,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request body');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should return 400 for missing idToken', async () => {
      const response = await request(app)
        .post('/v1/auth/exchange')
        .send({
          provider: 'google',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request body');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should return 400 for invalid provider', async () => {
      const response = await request(app)
        .post('/v1/auth/exchange')
        .send({
          provider: 'invalid',
          idToken: validGoogleIdToken,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request body');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should return 400 for empty idToken', async () => {
      const response = await request(app)
        .post('/v1/auth/exchange')
        .send({
          provider: 'google',
          idToken: '',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request body');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('Provider configuration', () => {
    it('should return 400 when Google is not configured', async () => {
      // Mock Google as not configured
      const { googleAuthService } = require('../src/lib/google');
      googleAuthService.isConfigured = jest.fn().mockReturnValue(false);

      const response = await request(app)
        .post('/v1/auth/exchange')
        .send({
          provider: 'google',
          idToken: validGoogleIdToken,
        })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'GOOGLE_NOT_CONFIGURED');
    });

    it('should return 400 when Apple is not configured', async () => {
      // Mock Apple as not configured
      const { appleAuthService } = require('../src/lib/apple');
      appleAuthService.isConfigured = jest.fn().mockReturnValue(false);

      const response = await request(app)
        .post('/v1/auth/exchange')
        .send({
          provider: 'apple',
          idToken: validGoogleIdToken,
        })
        .expect(400);

      expect(response.body).toHaveProperty('code', 'APPLE_NOT_CONFIGURED');
    });
  });

  describe('Error handling', () => {
    it('should return 401 for invalid ID token', async () => {
      // Mock verification failure
      const { googleAuthService } = require('../src/lib/google');
      googleAuthService.verifyIdToken = jest.fn().mockRejectedValue(
        new Error('Google token verification failed: Invalid token')
      );

      const response = await request(app)
        .post('/v1/auth/exchange')
        .send({
          provider: 'google',
          idToken: 'invalid-token',
        })
        .expect(401);

      expect(response.body).toHaveProperty('code', 'AUTH_FAILED');
    });

    it('should handle network errors gracefully', async () => {
      // Mock network error
      const { googleAuthService } = require('../src/lib/google');
      googleAuthService.verifyIdToken = jest.fn().mockRejectedValue(
        new Error('Network error')
      );

      const response = await request(app)
        .post('/v1/auth/exchange')
        .send({
          provider: 'google',
          idToken: validGoogleIdToken,
        })
        .expect(401);

      expect(response.body).toHaveProperty('code', 'AUTH_FAILED');
    });
  });
});

describe('GET /v1/auth/providers', () => {
  it('should return available auth providers', async () => {
    const response = await request(app)
      .get('/v1/auth/providers')
      .expect(200);

    expect(response.body).toHaveProperty('google');
    expect(response.body).toHaveProperty('apple');
    expect(response.body.google).toHaveProperty('enabled');
    expect(response.body.apple).toHaveProperty('enabled');
  });
});

describe('GET /.well-known/jwks.json', () => {
  it('should return server JWKS', async () => {
    const response = await request(app)
      .get('/.well-known/jwks.json')
      .expect(200);

    expect(response.body).toHaveProperty('keys');
    expect(Array.isArray(response.body.keys)).toBe(true);
    expect(response.body.keys.length).toBeGreaterThan(0);
    
    const key = response.body.keys[0];
    expect(key).toHaveProperty('kty');
    expect(key).toHaveProperty('use', 'sig');
    expect(key).toHaveProperty('alg', 'RS256');
  });
});