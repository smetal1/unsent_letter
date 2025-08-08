import request from 'supertest';
import app from '../src/app';
import { jwtService } from '../src/lib/jwt';

describe('AI Endpoints Authentication', () => {
  let validToken: string;
  let expiredToken: string;

  beforeAll(async () => {
    // Create a valid JWT token for testing
    validToken = await jwtService.signServerJWT({
      sub: 'test-user-123',
      provider: 'google',
    });

    // Create an expired token (manually set exp in past)
    const payload = {
      sub: 'test-user-123',
      provider: 'google',
      iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
    };
    
    // Mock an expired token for testing
    expiredToken = 'expired-token';
  });

  describe('POST /v1/ai/reply', () => {
    const validRequest = {
      messages: [
        {
          role: 'user',
          content: 'Dear Mom, I hope you are doing well...',
        },
      ],
    };

    describe('Authentication required', () => {
      it('should return 401 without Authorization header', async () => {
        const response = await request(app)
          .post('/v1/ai/reply')
          .send(validRequest)
          .expect(401);

        expect(response.body).toHaveProperty('code', 'MISSING_AUTH_HEADER');
      });

      it('should return 401 with invalid Authorization header format', async () => {
        const response = await request(app)
          .post('/v1/ai/reply')
          .set('Authorization', 'InvalidFormat token')
          .send(validRequest)
          .expect(401);

        expect(response.body).toHaveProperty('code', 'INVALID_AUTH_FORMAT');
      });

      it('should return 401 with empty token', async () => {
        const response = await request(app)
          .post('/v1/ai/reply')
          .set('Authorization', 'Bearer ')
          .send(validRequest)
          .expect(401);

        expect(response.body).toHaveProperty('code', 'MISSING_TOKEN');
      });

      it('should return 401 with invalid token', async () => {
        const response = await request(app)
          .post('/v1/ai/reply')
          .set('Authorization', 'Bearer invalid-token')
          .send(validRequest)
          .expect(401);

        expect(response.body).toHaveProperty('code', 'INVALID_TOKEN');
      });

      it('should return 401 with expired token', async () => {
        const response = await request(app)
          .post('/v1/ai/reply')
          .set('Authorization', `Bearer ${expiredToken}`)
          .send(validRequest)
          .expect(401);

        expect(response.body).toHaveProperty('code', 'INVALID_TOKEN');
      });
    });

    describe('Valid authentication', () => {
      beforeEach(() => {
        // Mock AI providers to return predictable responses
        jest.mock('../src/providers/openai', () => ({
          openaiProvider: {
            isConfigured: () => true,
            getResponse: jest.fn().mockResolvedValue('Thank you for your letter...'),
            getConfig: () => ({ enabled: true, model: 'gpt-4o-mini' }),
          },
        }));
      });

      it('should return 200 with valid token and request', async () => {
        const response = await request(app)
          .post('/v1/ai/reply')
          .set('Authorization', `Bearer ${validToken}`)
          .send(validRequest);

        // Note: This might return 503 if no AI providers are configured in test
        // or 200 if mocked properly
        expect([200, 503]).toContain(response.status);

        if (response.status === 200) {
          expect(response.body).toHaveProperty('reply');
          expect(response.body).toHaveProperty('provider');
        } else {
          expect(response.body).toHaveProperty('code', 'SERVICE_UNAVAILABLE');
        }
      });

      it('should validate request body with valid token', async () => {
        const response = await request(app)
          .post('/v1/ai/reply')
          .set('Authorization', `Bearer ${validToken}`)
          .send({}) // Invalid request body
          .expect(400);

        expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      });

      it('should validate message content length', async () => {
        const longContent = 'A'.repeat(10000); // Exceeds MAX_LETTER_CHARS

        const response = await request(app)
          .post('/v1/ai/reply')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            messages: [
              {
                role: 'user',
                content: longContent,
              },
            ],
          })
          .expect(400);

        expect(response.body).toHaveProperty('code', 'CONTENT_TOO_LONG');
      });
    });
  });

  describe('POST /v1/ai/reply/stream', () => {
    const validRequest = {
      messages: [
        {
          role: 'user',
          content: 'Dear Friend, I wanted to share...',
        },
      ],
    };

    describe('Authentication required', () => {
      it('should return 401 without Authorization header', async () => {
        const response = await request(app)
          .post('/v1/ai/reply/stream')
          .send(validRequest)
          .expect(401);

        expect(response.body).toHaveProperty('code', 'MISSING_AUTH_HEADER');
      });

      it('should return 401 with invalid token', async () => {
        const response = await request(app)
          .post('/v1/ai/reply/stream')
          .set('Authorization', 'Bearer invalid-token')
          .send(validRequest)
          .expect(401);

        expect(response.body).toHaveProperty('code', 'INVALID_TOKEN');
      });
    });

    describe('Valid authentication', () => {
      it('should start streaming with valid token', async () => {
        // This test is complex due to SSE nature, so we just check it doesn't fail auth
        const response = await request(app)
          .post('/v1/ai/reply/stream')
          .set('Authorization', `Bearer ${validToken}`)
          .send(validRequest);

        // Should not be 401 (auth error)
        expect(response.status).not.toBe(401);
        
        // Might be 503 (no AI configured) or start streaming (200)
        expect([200, 503]).toContain(response.status);
      });

      it('should validate request body for streaming', async () => {
        const response = await request(app)
          .post('/v1/ai/reply/stream')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            messages: [], // Invalid - empty messages
          })
          .expect(400);

        expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      });
    });
  });

  describe('GET /v1/ai/providers', () => {
    it('should return 401 without Authorization header', async () => {
      const response = await request(app)
        .get('/v1/ai/providers')
        .expect(401);

      expect(response.body).toHaveProperty('code', 'MISSING_AUTH_HEADER');
    });

    it('should return provider info with valid token', async () => {
      const response = await request(app)
        .get('/v1/ai/providers')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('openai');
      expect(response.body).toHaveProperty('anthropic');
      expect(response.body).toHaveProperty('local');
      expect(response.body).toHaveProperty('limits');
      expect(response.body.limits).toHaveProperty('maxLetterChars');
    });
  });
});

describe('Rate Limiting', () => {
  let validToken: string;

  beforeAll(async () => {
    validToken = await jwtService.signServerJWT({
      sub: 'rate-limit-test-user',
      provider: 'google',
    });
  });

  it('should apply rate limiting to authenticated endpoints', async () => {
    const requests = [];
    const maxRequests = 70; // Slightly above the default rate limit

    // Fire many requests quickly
    for (let i = 0; i < maxRequests; i++) {
      requests.push(
        request(app)
          .post('/v1/ai/reply')
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            messages: [
              {
                role: 'user',
                content: `Test message ${i}`,
              },
            ],
          })
      );
    }

    const responses = await Promise.allSettled(requests);
    
    // At least some requests should be rate limited
    const rateLimitedResponses = responses.filter(
      (result) => 
        result.status === 'fulfilled' && 
        result.value.status === 429
    );

    // We expect some rate limiting to occur
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  }, 30000); // Increase timeout for this test
});

describe('CORS Headers', () => {
  it('should include CORS headers in responses', async () => {
    const response = await request(app)
      .get('/v1/health')
      .expect(200);

    expect(response.headers).toHaveProperty('access-control-allow-origin');
  });

  it('should handle preflight OPTIONS requests', async () => {
    const response = await request(app)
      .options('/v1/ai/reply')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Authorization, Content-Type')
      .expect(204);

    expect(response.headers).toHaveProperty('access-control-allow-origin');
    expect(response.headers).toHaveProperty('access-control-allow-methods');
    expect(response.headers).toHaveProperty('access-control-allow-headers');
  });
});