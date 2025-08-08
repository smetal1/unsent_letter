const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const dotenv = require('dotenv');

// Import routes
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const adminRoutes = require('./routes/admin');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for SSE
}));

// CORS configuration
const corsOrigins = process.env.ALLOW_ORIGINS?.split(',').map(origin => origin.trim()) || [
  'http://localhost:5173',
  'capacitor://localhost',
];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
}));

// Rate limiting
const rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);

const limiter = rateLimit({
  windowMs: rateLimitWindow,
  max: rateLimitMax,
  message: {
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: rateLimitWindow / 1000,
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for admin endpoints
  skip: (req) => req.path.startsWith('/admin') || req.path.startsWith('/v1/health'),
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  type: ['application/json', 'text/plain'],
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files (for admin page)
app.use('/admin', express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/v1/auth', authRoutes);
app.use('/v1/ai', aiRoutes);

// Admin routes (includes health and config endpoints)
app.use('/', adminRoutes);

// JWKS endpoint (if needed)
app.get('/.well-known/jwks.json', authRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Unsent Letters API',
    version: '1.0.0',
    description: 'Privacy-first AI journaling server',
    endpoints: {
      health: '/v1/health',
      auth: '/v1/auth',
      ai: '/v1/ai',
      admin: '/admin',
    },
    documentation: 'https://github.com/your-org/unsent-letters',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
  });
});

// Global error handler
app.use((error, req, res, _next) => {
  console.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDevelopment && { details: error.message }),
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Unsent Letters server running on port ${PORT}`);
    console.log(`📊 Admin dashboard: http://localhost:${PORT}/admin`);
    console.log(`🏥 Health check: http://localhost:${PORT}/v1/health`);
    
    // Log configuration status
    console.log('\n📋 Configuration Status:');
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   CORS Origins: ${corsOrigins.join(', ')}`);
    console.log(`   Rate Limit: ${rateLimitMax} requests per ${rateLimitWindow/1000}s`);
    
    // Log provider status
    const providers = [];
    if (process.env.OPENAI_API_KEY) providers.push('OpenAI');
    if (process.env.ANTHROPIC_API_KEY) providers.push('Anthropic');
    if (process.env.LOCAL_PROVIDER && process.env.LOCAL_PROVIDER !== 'none') providers.push(`Local (${process.env.LOCAL_PROVIDER})`);
    
    console.log(`   AI Providers: ${providers.length > 0 ? providers.join(', ') : 'None configured'}`);
    
    // Log auth status
    const authProviders = [];
    if (process.env.GOOGLE_CLIENT_ID_IOS || process.env.GOOGLE_CLIENT_ID_ANDROID) authProviders.push('Google');
    if (process.env.APPLE_AUDIENCE_BUNDLE_ID) authProviders.push('Apple');
    
    console.log(`   Auth Providers: ${authProviders.length > 0 ? authProviders.join(', ') : 'None configured'}`);
    console.log('');
  });
}

module.exports = app;