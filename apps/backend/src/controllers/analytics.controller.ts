import { Request, Response } from 'express';
import * as analyticsService from '../services/analytics.service';
import { requireOrgHeader } from '../utils/requestHelpers';
import { prisma } from '../utils/prisma';

async function checkOrgRole(req: Request, requiredRoles: string[]) {
  const userId = (req as any).user.userId as string;
  let organizationId: string;
  try {
    organizationId = requireOrgHeader(req);
  } catch (e: any) {
    throw new Error('BadRequest: ' + e.message);
  }

  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { role: true }
  });

  if (!membership || !requiredRoles.includes(membership.role.name)) {
    throw new Error('Forbidden: Insufficient permissions for this analytics view');
  }
  return { userId, organizationId, membership };
}

export const getOverview = async (req: Request, res: Response) => {
  try {
    const { organizationId } = await checkOrgRole(req, ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER']);
    const data = await analyticsService.getOverview(organizationId);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Analytics endpoint error:', error);
    if (error.message?.includes('BadRequest')) return res.status(400).json({ success: false, message: error.message });
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getAIUsage = async (req: Request, res: Response) => {
  try {
    const { organizationId } = await checkOrgRole(req, ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER']);
    const days = parseInt(req.query['days'] as string || '30', 10);
    const data = await analyticsService.getAIUsageSeries(organizationId, days);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Analytics endpoint error:', error);
    if (error.message?.includes('BadRequest')) return res.status(400).json({ success: false, message: error.message });
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getWorkflowStats = async (req: Request, res: Response) => {
  try {
    const { organizationId } = await checkOrgRole(req, ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER']);
    const data = await analyticsService.getWorkflowStats(organizationId);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Analytics endpoint error:', error);
    if (error.message?.includes('BadRequest')) return res.status(400).json({ success: false, message: error.message });
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getTopUsers = async (req: Request, res: Response) => {
  try {
    const { organizationId } = await checkOrgRole(req, ['OWNER', 'ADMIN', 'MANAGER']);
    const limit = parseInt(req.query['limit'] as string || '5', 10);
    const data = await analyticsService.getTopUsers(organizationId, limit);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Analytics endpoint error:', error);
    if (error.message?.includes('BadRequest')) return res.status(400).json({ success: false, message: error.message });
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getProviderBreakdown = async (req: Request, res: Response) => {
  try {
    const { organizationId } = await checkOrgRole(req, ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER']);
    const data = await analyticsService.getProviderBreakdown(organizationId);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('Analytics endpoint error:', error);
    if (error.message?.includes('BadRequest')) return res.status(400).json({ success: false, message: error.message });
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const exportAuditCsv = async (req: Request, res: Response) => {
  try {
    const { organizationId } = await checkOrgRole(req, ['OWNER', 'ADMIN']);
    const days = parseInt(req.query['days'] as string || '30', 10);
    const rows = await analyticsService.getAuditExportRows(organizationId, days);
    const csvData = analyticsService.rowsToCsv(rows);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_export_${organizationId}_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.status(200).send(csvData);
  } catch (error: any) {
    console.error('Analytics endpoint error:', error);
    if (error.message?.includes('BadRequest')) return res.status(400).json({ success: false, message: error.message });
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getPlatformHealth = async (req: Request, res: Response) => {
  try {
    const health = {
      backend: { status: true, note: 'Operational' },
      postgres: { status: false, note: 'Checking...' },
      redis:    { status: false, note: 'Checking...' },
      minio:    { status: false, note: 'Checking...' },
      n8n:      { status: false, note: 'Checking...' },
      openai:   { status: false, note: 'Checking...' },
      ollama:   { status: false, note: 'Checking...' },
    };

    // ── PostgreSQL ────────────────────────────────────────────────────────────
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.postgres = { status: true, note: 'Operational' };
    } catch {
      health.postgres = { status: false, note: 'Offline' };
    }

    // ── Redis (TCP probe — works whether or not ioredis is installed) ─────────
    await new Promise<void>((resolve) => {
      const net = require('net');
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const match = redisUrl.match(/redis:\/\/(?:[^@]+@)?([^:/]+):?(\d+)?/);
      const host = match?.[1] || 'localhost';
      const port = parseInt(match?.[2] || '6379', 10);
      const socket = new net.Socket();
      socket.setTimeout(1500);
      socket.once('connect', () => {
        health.redis = { status: true, note: 'Operational' };
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        health.redis = { status: false, note: 'Offline / not reachable' };
        socket.destroy();
        resolve();
      });
      socket.once('timeout', () => {
        health.redis = { status: false, note: 'Timed out' };
        socket.destroy();
        resolve();
      });
      socket.connect(port, host);
    });

    // ── MinIO ─────────────────────────────────────────────────────────────────
    try {
      const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: 'us-east-1',
        endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
        credentials: {
          accessKeyId: process.env.MINIO_ROOT_USER || 'admin',
          secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'password123',
        },
        forcePathStyle: true,
      });
      await s3.send(new HeadBucketCommand({ Bucket: process.env.MINIO_BUCKET_NAME || 'automation-platform-docs' }));
      health.minio = { status: true, note: 'Operational' };
    } catch {
      health.minio = { status: false, note: 'Offline / Bucket missing' };
    }

    // ── n8n ───────────────────────────────────────────────────────────────────
    try {
      const axios = require('axios');
      const n8nUrl = process.env.N8N_URL || 'http://localhost:5680';
      // Try /healthz first, then /rest/settings as fallback
      let n8nUp = false;
      try {
        await axios.get(`${n8nUrl}/healthz`, { timeout: 2000 });
        n8nUp = true;
      } catch {
        try {
          await axios.get(`${n8nUrl}/rest/settings`, { timeout: 2000 });
          n8nUp = true;
        } catch {}
      }
      if (n8nUp) {
        const apiKey = process.env.N8N_API_KEY;
        if (!apiKey || apiKey.trim() === '') {
          health.n8n = { status: false, note: 'Running, but API Key missing' };
        } else {
          // Verify the key works
          try {
            await axios.get(`${n8nUrl}/api/v1/workflows?limit=1`, {
              headers: { 'X-N8N-API-KEY': apiKey },
              timeout: 2000,
            });
            health.n8n = { status: true, note: 'Operational' };
          } catch {
            health.n8n = { status: false, note: 'Running, but API Key invalid' };
          }
        }
      } else {
        health.n8n = { status: false, note: 'Offline' };
      }
    } catch {
      health.n8n = { status: false, note: 'Offline' };
    }

    // ── OpenAI ────────────────────────────────────────────────────────────────
    health.openai = process.env.OPENAI_API_KEY
      ? { status: true, note: 'Configured' }
      : { status: false, note: 'API Key missing' };

    // ── Ollama ────────────────────────────────────────────────────────────────
    try {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const ollamaRes = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (ollamaRes.ok) {
        const data: any = await ollamaRes.json();
        const modelCount = data?.models?.length ?? 0;
        health.ollama = { status: true, note: `Operational (${modelCount} model${modelCount !== 1 ? 's' : ''} loaded)` };
      } else {
        health.ollama = { status: false, note: 'Reachable but returned error' };
      }
    } catch {
      health.ollama = { status: false, note: 'Offline — run: ollama serve' };
    }

    res.status(200).json({ success: true, data: health });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

