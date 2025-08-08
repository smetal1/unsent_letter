"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const ai_1 = __importDefault(require("./routes/ai"));
const admin_1 = __importDefault(require("./routes/admin"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8080;
app.set('trust proxy', 1);
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));
const corsOrigins = process.env.ALLOW_ORIGINS?.split(',').map(origin => origin.trim()) || [
    'http://localhost:5173',
    'capacitor://localhost',
];
app.use((0, cors_1.default)({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
}));
const rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);
const limiter = (0, express_rate_limit_1.default)({
    windowMs: rateLimitWindow,
    max: rateLimitMax,
    message: {
        error: 'Too many requests from this IP',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimitWindow / 1000,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/admin') || req.path.startsWith('/v1/health'),
});
app.use(limiter);
app.use(express_1.default.json({
    limit: '10mb',
    type: ['application/json', 'text/plain'],
}));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
app.use('/admin', express_1.default.static(path_1.default.join(__dirname, '../public')));
app.use('/v1/auth', auth_1.default);
app.use('/v1/ai', ai_1.default);
app.use('/', admin_1.default);
app.get('/.well-known/jwks.json', auth_1.default);
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
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        code: 'NOT_FOUND',
        path: req.originalUrl,
    });
});
app.use((error, req, res, next) => {
    console.error('Unhandled error:', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
    });
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        ...(isDevelopment && { details: error.message }),
    });
});
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Unsent Letters server running on port ${PORT}`);
        console.log(`📊 Admin dashboard: http://localhost:${PORT}/admin`);
        console.log(`🏥 Health check: http://localhost:${PORT}/v1/health`);
        console.log('\n📋 Configuration Status:');
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   CORS Origins: ${corsOrigins.join(', ')}`);
        console.log(`   Rate Limit: ${rateLimitMax} requests per ${rateLimitWindow / 1000}s`);
        const providers = [];
        if (process.env.OPENAI_API_KEY)
            providers.push('OpenAI');
        if (process.env.ANTHROPIC_API_KEY)
            providers.push('Anthropic');
        if (process.env.LOCAL_PROVIDER && process.env.LOCAL_PROVIDER !== 'none')
            providers.push(`Local (${process.env.LOCAL_PROVIDER})`);
        console.log(`   AI Providers: ${providers.length > 0 ? providers.join(', ') : 'None configured'}`);
        const authProviders = [];
        if (process.env.GOOGLE_CLIENT_ID_IOS || process.env.GOOGLE_CLIENT_ID_ANDROID)
            authProviders.push('Google');
        if (process.env.APPLE_AUDIENCE_BUNDLE_ID)
            authProviders.push('Apple');
        console.log(`   Auth Providers: ${authProviders.length > 0 ? authProviders.join(', ') : 'None configured'}`);
        console.log('');
    });
}
exports.default = app;
