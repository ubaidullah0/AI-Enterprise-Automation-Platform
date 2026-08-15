import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { requireOrgHeader, getParam } from '../utils/requestHelpers';

// ─── GET /api/v1/audit-logs ──────────────────────────────────────────────────
export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    // Only OWNER/ADMIN can view audit logs
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { role: true }
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role.name)) {
      return res.status(403).json({ success: false, message: 'Access denied. Requires Admin or Owner role.' });
    }

    const { resource, action, userId: filterUserId, startDate, endDate, page: pageQuery, limit: limitQuery } = req.query;
    
    const page = parseInt(pageQuery as string || '1');
    const limit = parseInt(limitQuery as string || '20');
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (resource) where.resource = resource as string;
    if (action) where.action = action as string;
    if (filterUserId) where.userId = filterUserId as string;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } }
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── GET /api/v1/audit-logs/export ───────────────────────────────────────────
export const exportAuditLogsCSV = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    // Only OWNER/ADMIN can export audit logs
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { role: true }
    });

    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role.name)) {
      return res.status(403).json({ success: false, message: 'Access denied. Requires Admin or Owner role.' });
    }

    const { resource, action, userId: filterUserId, startDate, endDate } = req.query;

    const where: any = { organizationId };
    if (resource) where.resource = resource as string;
    if (action) where.action = action as string;
    if (filterUserId) where.userId = filterUserId as string;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true } } }
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');

    let csv = 'Timestamp,User,Resource,Action,Old Data,New Data\n';
    for (const log of logs) {
      const ts = log.createdAt.toISOString();
      const user = log.user?.email || 'System';
      const resName = log.resource;
      const act = log.action;
      const oldD = JSON.stringify(log.oldData || {}).replace(/"/g, '""');
      const newD = JSON.stringify(log.newData || {}).replace(/"/g, '""');
      csv += `"${ts}","${user}","${resName}","${act}","${oldD}","${newD}"\n`;
    }

    res.status(200).send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
