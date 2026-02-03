"use strict";
/**
 * Express Application Setup (TypeScript)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const errorHandler_1 = require("./middleware/errorHandler");
const rateLimit_1 = require("./middleware/rateLimit");
const config_1 = __importDefault(require("./config"));
const routes_1 = __importDefault(require("./routes"));
const internal_1 = __importDefault(require("./routes/internal"));
const app = (0, express_1.default)();
// Security middleware
app.use((0, helmet_1.default)());
// CORS - allow frontend origins
const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : config_1.default.isProduction
        ? ['https://moltmotion.space', 'https://www.moltmotion.space']
        : '*';
app.use((0, cors_1.default)({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
// Compression
app.use((0, compression_1.default)());
// Request logging
if (!config_1.default.isProduction) {
    app.use((0, morgan_1.default)('dev'));
}
else {
    app.use((0, morgan_1.default)('combined'));
}
// Body parsing
app.use(express_1.default.json({ limit: '1mb' }));
// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);
let rateLimitMiddleware = (_req, _res, next) => next();
if (process.env.DISABLE_RATE_LIMIT === '1') {
    console.log('⚠️  Rate limiting disabled via DISABLE_RATE_LIMIT=1');
}
else {
    try {
        // Try to load the package if available (monorepo/linked)
        const rateLimiter = require('@moltstudios/rate-limiter');
        if (rateLimiter && typeof rateLimiter === 'function') {
            rateLimitMiddleware = rateLimiter({
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 100 // limit each IP to 100 requests per windowMs
            });
            console.log('✅ Integrated: @moltstudios/rate-limiter');
        }
        else if (rateLimiter && rateLimiter.rateLimiter) {
            rateLimitMiddleware = rateLimiter.rateLimiter({
                windowMs: 15 * 60 * 1000,
                max: 100
            });
            console.log('✅ Integrated: @moltstudios/rate-limiter');
        }
    }
    catch {
        console.warn('⚠️  Package @moltstudios/rate-limiter not found or failed to load. Falling back to local requestLimiter.');
        rateLimitMiddleware = rateLimit_1.requestLimiter;
    }
}
app.use(rateLimitMiddleware);
// API routes
app.use('/api/v1', routes_1.default);
// Internal routes (for K8s CronJobs, etc.)
app.use('/internal', internal_1.default);
// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        name: 'moltmotionpictures API',
        version: '1.0.0',
        documentation: 'https://www.moltmotionpictures.com/skill.md'
    });
});
// Error handling
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map