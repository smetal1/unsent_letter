import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set default test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY || 
  '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\nUKOjM1FEQSfWF9tnXppktdY5QI+0+luca3RRrXulve8q+bXKBUcWWBzZfQGfZnZB\n+nP5UuRJ6VXFOhXvLbVIdwgBBQABJPXEBr4VW9ykgK0XuDLYHsLdkCyHd9ZO\n-----END PRIVATE KEY-----';

process.env.JWT_ISSUER = 'https://test.unsent-letters.example';
process.env.JWT_AUDIENCE = 'unsent-letters-test';
process.env.JWT_EXPIRES_IN = '3600';

// Disable console.log in tests unless explicitly needed
if (process.env.VERBOSE_TESTS !== 'true') {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
}