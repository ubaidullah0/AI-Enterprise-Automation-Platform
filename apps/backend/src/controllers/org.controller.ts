import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import {
  createOrgSchema,
  inviteMemberSchema,
  changeRoleSchema
} from '../schemas/org.schema';
import crypto from 'crypto';
import { requireOrgHeader, getParam } from '../utils/requestHelpers';

// ─── Helper: Require Admin or Owner in org ────────────────────────────────────
const requireOrgAdmin = async (userId: string, organizationId: string) => {
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { role: true }
  });
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role.name)) {
    throw new Error('Forbidden: Requires Admin or Owner role in this organization');
  }
  return membership;
};

// ─── POST /api/v1/orgs ────────────────────────────────────────────────────────
export const createOrganization = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const { name } = createOrgSchema.parse(req.body);

    // Get or create OWNER role
    let ownerRole = await prisma.organizationRole.findUnique({ where: { name: 'OWNER' } });
    if (!ownerRole) {
      ownerRole = await prisma.organizationRole.create({
        data: { name: 'OWNER', permissions: ['*'] }
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create org
      const newOrg = await tx.organization.create({ data: { name } });

      // 2. Add user as OWNER
      await tx.organizationMember.create({
        data: { userId, organizationId: newOrg.id, roleId: ownerRole!.id }
      });

      // 3. Always set as active org
      await tx.user.update({
        where: { id: userId },
        data: { activeOrganizationId: newOrg.id }
      });

      return newOrg;
    });

    await prisma.auditLog.create({
      data: { userId, organizationId: result.id, resource: 'Organization', action: 'CREATE', newData: { name: result.name } }
    });

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ success: false, errors: error.errors });
    console.error('Create Org Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};


// ─── GET /api/v1/orgs/:id ─────────────────────────────────────────────────────
export const getOrganization = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    const id = getParam(req, 'id');

    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: id } }
    });
    if (!membership) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
            role: true
          }
        },
        invitations: true
      }
    });

    res.status(200).json({ success: true, data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/v1/orgs/:id/invite ────────────────────────────────────────────
export const inviteMember = async (req: Request, res: Response) => {
  try {
    const inviterId = (req as any).user.userId as string;
    const organizationId = req.params['id'] as string;

    await requireOrgAdmin(inviterId, organizationId);

    const { email, role } = inviteMemberSchema.parse(req.body);

    const targetRole = await prisma.organizationRole.findUnique({ where: { name: role } });
    if (!targetRole) return res.status(400).json({ success: false, message: 'Invalid role' });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: existingUser.id, organizationId } }
      });
      if (existingMember) return res.status(400).json({ success: false, message: 'User is already a member' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.organizationInvitation.create({
      data: { email, organizationId, roleId: targetRole.id, inviterId, token, expiresAt }
    });

    await prisma.auditLog.create({
      data: { userId: inviterId, organizationId, resource: 'OrganizationInvitation', action: 'CREATE', newData: { email, role } }
    });

    res.status(201).json({ success: true, message: 'Invitation created', data: { token } });
  } catch (error: any) {
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    if (error.name === 'ZodError') return res.status(400).json({ success: false, errors: error.errors });
    console.error('Invite Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── PUT /api/v1/orgs/:id/members/:userId/role ───────────────────────────────
export const changeRole = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.userId as string;
    const organizationId = req.params['id'] as string;
    const userId = req.params['userId'] as string;

    await requireOrgAdmin(adminId, organizationId);

    const { role } = changeRoleSchema.parse(req.body);
    const targetRole = await prisma.organizationRole.findUnique({ where: { name: role } });
    if (!targetRole) return res.status(400).json({ success: false, message: 'Invalid role' });

    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { role: true }
    });
    if (!membership) return res.status(404).json({ success: false, message: 'Member not found' });

    if (membership.role.name === 'OWNER') {
      const ownersCount = await prisma.organizationMember.count({
        where: { organizationId, role: { name: 'OWNER' } }
      });
      if (ownersCount <= 1) return res.status(400).json({ success: false, message: 'Cannot demote the last owner' });
    }

    const updated = await prisma.organizationMember.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { roleId: targetRole.id }
    });

    await prisma.auditLog.create({
      data: {
        userId: adminId, organizationId,
        resource: 'OrganizationMember', action: 'UPDATE_ROLE',
        oldData: { roleId: membership.roleId },
        newData: { roleId: targetRole.id, userId }
      }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── DELETE /api/v1/orgs/:id/members/:userId ─────────────────────────────────
export const removeMember = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.userId as string;
    const organizationId = req.params['id'] as string;
    const userId = req.params['userId'] as string;

    await requireOrgAdmin(adminId, organizationId);

    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { role: true }
    });
    if (!membership) return res.status(404).json({ success: false, message: 'Member not found' });

    if (membership.role.name === 'OWNER') {
      const ownersCount = await prisma.organizationMember.count({
        where: { organizationId, role: { name: 'OWNER' } }
      });
      if (ownersCount <= 1) return res.status(400).json({ success: false, message: 'Cannot remove the last owner' });
    }

    await prisma.organizationMember.delete({
      where: { userId_organizationId: { userId, organizationId } }
    });

    await prisma.auditLog.create({
      data: {
        userId: adminId, organizationId,
        resource: 'OrganizationMember', action: 'DELETE',
        oldData: { userId }
      }
    });

    res.status(200).json({ success: true, message: 'Member removed' });
  } catch (error: any) {
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
