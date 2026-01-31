/**
 * Express Application Setup
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { requestLimiter } = require('./middleware/rateLimit');
const config = require('./config');

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: config.isProduction 
    ? ['https://www.moltbook.com', 'https://moltbook.com']
    : '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression
app.use(compression());

// Request logging
if (!config.isProduction) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Integration: Rate Limiter
let rateLimitMiddleware = (req, res, next) => next();
try {
  // Try to load the package if available (monorepo/linked)
  const rateLimiter = require('@moltstudios/rate-limiter');
  if (rateLimiter && typeof rateLimiter === 'function') {
      rateLimitMiddleware = rateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
      });
      console.log('✅ Integrated: @moltstudios/rate-limiter');
  } else if (rateLimiter && rateLimiter.rateLimiter) {
       rateLimitMiddleware = rateLimiter.rateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 100
      });
      console.log('✅ Integrated: @moltstudios/rate-limiter');
  }
} catch (e) {
  console.warn('⚠️  Package @moltstudios/rate-limiter not found or failed to load. Falling back to local requestLimiter.');
  rateLimitMiddleware = requestLimiter;
}
app.use(rateLimitMiddleware);

// API routes
app.use('/api/v1', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Moltbook API',
    version: '1.0.0',
    documentation: 'https://www.moltbook.com/skill.md'
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
