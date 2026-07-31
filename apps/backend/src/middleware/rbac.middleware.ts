import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

/**
 * RBAC Middleware — Verifies the user has one of the required roles
 * in their active organization.
 *
 * Usage: router.delete('/...', requireAuth, requireOrgRole(['OWNER', 'ADMIN']), handler)
 */
export const requireOrgRole = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId as string | undefined;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const orgId = (req.headers['x-organization-id'] as string | undefined);
      if (!orgId) {
        return res.status(400).json({ success: false, message: 'X-Organization-ID header required' });
      }

      const membership = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId, organizationId: orgId } },
        include: { role: true }
      });

      if (!membership) {
        return res.status(403).json({ success: false, message: 'You are not a member of this organization' });
      }

      if (!allowedRoles.includes(membership.role.name)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
        });
      }

      // Attach org membership to request for downstream use
      (req as any).orgMembership = membership;
      next();
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Authorization check failed' });
    }
  };
};

/**
 * Middleware to log every API action to the audit log table.
 * Attach after requireAuth on sensitive routes.
 */
export const auditLog = (resource: string, action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // We log after the response; store original json method
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode < 400) {
        const userId = (req as any).user?.userId as string | undefined;
        const orgId = req.headers['x-organization-id'] as string | undefined;
        if (userId && orgId) {
          prisma.auditLog.create({
            data: {
              userId,
              organizationId: orgId,
              resource,
              action,
              newData: (req.body as object) ?? undefined
            }
          }).catch(() => {}); // Non-blocking, non-fatal
        }
      }
      return originalJson(body);
    };
    next();
  };
};
