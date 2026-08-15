import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import swaggerUi from 'swagger-ui-express';

// ─── Routes ──────────────────────────────────────────────────────────────────
import authRoutes from './routes/auth.routes';
import orgRoutes from './routes/org.routes';
import workflowRoutes from './routes/workflow.routes';
import aiRoutes from './routes/ai.routes';
import notificationRoutes from './routes/notification.routes';
import auditRoutes from './routes/audit.routes';
import orgApiKeyRoutes from './routes/org-api-keys.routes';
import analyticsRoutes from './routes/analytics.routes';
import webhookRoutes from './routes/webhook.routes';
import documentRoutes from './routes/documents.routes';
import jobsRoutes from './routes/jobs.routes';
import { jobQueueService } from './services/jobs/job-queue.service';
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const prisma = new PrismaClient();

// ─── Logger ───────────────────────────────────────────────────────────────────
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // No origin = curl / Postman / mobile — allow
    if (!origin) return callback(null, true);

    // In development: allow any localhost port (covers 5173, 5174, 5175, ...)
    const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin)
      || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
    if (isLocalhost) return callback(null, true);

    // In production: only allow the configured FRONTEND_URL / CORS_ORIGINS
    const rawList = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '';
    const allowed = rawList.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (allowed.includes(origin)) return callback(null, true);

    callback(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ─── Request Logger ───────────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/org-api-keys', orgApiKeyRoutes);
app.use('/api/v1/orgs', orgRoutes);
app.use('/api/v1/workflows', workflowRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/jobs', jobsRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/v1/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    res.status(200).json({
      status: 'OK',
      services: { database: 'Connected', backend: 'Running' },
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ err: error }, 'Health check failed');
    res.status(503).json({
      status: 'ERROR',
      services: { database: 'Disconnected', backend: 'Running' },
      timestamp: new Date().toISOString()
    });
  }
});

// ─── Swagger Docs ─────────────────────────────────────────────────────────────
const swaggerDocument = {
  openapi: '3.0.0',
  info: { title: 'AI Enterprise Automation Platform API', version: '1.0.0' },
  paths: {}
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.url}` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(port, () => {
  logger.info(`Backend server is running on http://localhost:${port}`);
  logger.info(`Swagger docs available at http://localhost:${port}/api-docs`);
  
  // Start background job queue if not explicitly disabled
  if (process.env.WORKER_ENABLED !== 'false') {
    jobQueueService.queue.start().catch(err => {
      logger.error({ err }, 'Failed to start background job queue');
    });

    // Register handlers for background jobs
    jobQueueService.queue.process('TEST_HEAVY_TASK', async (job) => {
      logger.info(`Executing TEST_HEAVY_TASK for job ${job.id}`);
      // Simulate heavy work
      await new Promise(resolve => setTimeout(resolve, 5000));
      logger.info(`Completed TEST_HEAVY_TASK for job ${job.id}`);
      
      // We can also trigger a notification when it succeeds
      if (job.organizationId) {
        // Just demonstrating cross-service usage. We'd ideally need the user ID here,
        // which we passed in the payload.
        const payload = job.payload as any;
        if (payload?.userId) {
          const { notificationService } = require('./services/notification.service');
          await notificationService.notifyUser(
            payload.userId,
            job.organizationId,
            'SUCCESS',
            'Test Job Completed',
            'Your heavy background task has finished successfully.'
          );
        }
      }
    });
  }
});

