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

    // ── Redis ─────────────────────────────────────────────────────────────────
    health.redis = { status: true, note: 'Operational (Simulated)' };

    // ── MinIO ─────────────────────────────────────────────────────────────────
    health.minio = { status: true, note: 'Operational (Simulated)' };

    // ── n8n ───────────────────────────────────────────────────────────────────
    health.n8n = { status: true, note: 'Operational (Simulated)' };

    // ── OpenAI ────────────────────────────────────────────────────────────────
    health.openai = { status: true, note: 'Configured (Simulated)' };

    // ── Ollama ────────────────────────────────────────────────────────────────
    health.ollama = { status: true, note: 'Operational (Simulated)' };

    res.status(200).json({ success: true, data: health });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

