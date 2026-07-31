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

    const page = parseInt(req.query['page'] as string || '1');
    const limit = parseInt(req.query['limit'] as string || '20');
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } }
        }
      }),
      prisma.auditLog.count({ where: { organizationId } })
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
