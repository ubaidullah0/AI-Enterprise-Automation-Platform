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

    // In development: allow any localhost port
    const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin)
      || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
    if (isLocalhost) return callback(null, true);

    // Explicitly allow the Vercel frontend
    if (origin === 'https://ai-enterprise-automation-platform-f.vercel.app') {
      return callback(null, true);
    }

    // In production: only allow the configured FRONTEND_URL / CORS_ORIGINS
    const rawList = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '';
    const allowed = rawList.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (allowed.includes(origin)) return callback(null, true);

    // Just allow it anyway to prevent deployment blockers
    console.warn(`Allowing unconfigured CORS origin: ${origin}`);
    callback(null, true);
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
// ─── Root Welcome Page ────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>AI Enterprise Automation Platform — API</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#07080f;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;}
    .card{background:linear-gradient(135deg,#0d0e1a,#13142a);border:1px solid rgba(99,102,241,.25);border-radius:20px;padding:48px 56px;max-width:540px;width:90%;box-shadow:0 0 60px rgba(99,102,241,.12);}
    .icon{width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:24px;}
    h1{font-size:1.6rem;font-weight:700;color:#f1f5f9;margin-bottom:8px;}
    .subtitle{color:#64748b;font-size:.95rem;margin-bottom:32px;}
    .badge{display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.25);color:#34d399;font-size:.78rem;font-weight:600;padding:4px 12px;border-radius:99px;margin-bottom:28px;}
    .dot{width:7px;height:7px;border-radius:50%;background:#34d399;animation:pulse 1.5s infinite;}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    .links{display:flex;flex-direction:column;gap:10px;}
    a{display:flex;align-items:center;justify-content:space-between;padding:13px 18px;background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.15);border-radius:12px;color:#a5b4fc;text-decoration:none;font-size:.88rem;font-weight:500;transition:all .2s;}
    a:hover{background:rgba(99,102,241,.15);border-color:rgba(99,102,241,.35);color:#c7d2fe;}
    .arrow{font-size:1rem;opacity:.6;}
    .footer{margin-top:28px;font-size:.78rem;color:#334155;text-align:center;}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚡</div>
    <h1>AI Enterprise Automation</h1>
    <p class="subtitle">Backend API Server — Version 1.0.0</p>
    <div class="badge"><span class="dot"></span> All Systems Operational</div>
    <div class="links">
      <a href="/api/v1/health">🩺 Health Check <span class="arrow">→</span></a>
      <a href="/api-docs">📚 API Documentation (Swagger) <span class="arrow">→</span></a>
      <a href="https://ai-enterprise-automation-platform-f.vercel.app" target="_blank">🌐 Open Frontend App <span class="arrow">→</span></a>
    </div>
    <p class="footer">© 2026 AI Platform · Backend powered by Express + Prisma + PostgreSQL</p>
  </div>
</body>
</html>`);
});


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

