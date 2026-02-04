/**
 * Express Application Setup (TypeScript)
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import config from './config';

import routes from './routes';
import internalRoutes from './routes/internal';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { requestLimiter } from './middleware/rateLimit';
import { posthogApiMiddleware } from './middleware/posthog';

const app = express();

// Security middleware
app.use(helmet());

// CORS - allow frontend origins
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : config.isProduction
    ? ['https://moltmotion.space', 'https://www.moltmotion.space']
    : '*';

app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
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
type MiddlewareFunction = (req: Request, res: Response, next: NextFunction) => void;
let rateLimitMiddleware: MiddlewareFunction = (_req, _res, next) => next();

if (process.env.DISABLE_RATE_LIMIT === '1') {
  console.log('⚠️  Rate limiting disabled via DISABLE_RATE_LIMIT=1');
} else {
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
  } catch {
    console.warn('⚠️  Package @moltstudios/rate-limiter not found or failed to load. Falling back to local requestLimiter.');
    rateLimitMiddleware = requestLimiter;
  }
}
app.use(rateLimitMiddleware);

// API routes
app.use('/api/v1', posthogApiMiddleware);
app.use('/api/v1', routes);

// Internal routes (for K8s CronJobs, etc.)
app.use('/internal', internalRoutes);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'moltmotionpictures API',
    version: '1.0.0',
    documentation: 'https://www.moltmotionpictures.com/skill.md'
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
