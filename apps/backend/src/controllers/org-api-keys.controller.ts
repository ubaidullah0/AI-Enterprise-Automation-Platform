/**
 * org-api-keys.controller.ts
 *
 * Thin controller — delegates all business logic to org-api-keys.service.ts
 * Handles HTTP request/response + input validation + audit logging only.
 *
 * Routes:
 *   GET    /api/v1/orgs/api-keys              → listKeys
 *   POST   /api/v1/orgs/api-keys              → createKey
 *   PUT    /api/v1/orgs/api-keys/:id          → updateKey
 *   DELETE /api/v1/orgs/api-keys/:id          → deleteKey
 *   POST   /api/v1/orgs/api-keys/:id/validate → validateKey
 *   POST   /api/v1/orgs/api-keys/:id/default  → setDefault
 */

import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { requireOrgHeader, getParam } from '../utils/requestHelpers';
import { createOrgApiKeySchema, updateOrgApiKeySchema } from '../schemas/org-api-keys.schema';
import * as orgApiKeysService from '../services/org-api-keys.service';

// ── Helper ────────────────────────────────────────────────────────────────────
const getOrgAndUser = (req: Request): { userId: string; organizationId: string } | null => {
  try {
    const userId = (req as any).user.userId as string;
    const organizationId = requireOrgHeader(req);
    return { userId, organizationId };
  } catch {
    return null;
  }
};

// ── GET /api/v1/orgs/api-keys ─────────────────────────────────────────────────
export const listKeys = async (req: Request, res: Response): Promise<void> => {
  const ctx = getOrgAndUser(req);
  if (!ctx) { res.status(400).json({ success: false, message: 'X-Organization-ID header is required' }); return; }

  try {
    const keys = await orgApiKeysService.listKeys(ctx.organizationId);
    res.status(200).json({ success: true, data: keys });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── POST /api/v1/orgs/api-keys ────────────────────────────────────────────────
export const createKey = async (req: Request, res: Response): Promise<void> => {
  const ctx = getOrgAndUser(req);
  if (!ctx) { res.status(400).json({ success: false, message: 'X-Organization-ID header is required' }); return; }

  const parsed = createOrgApiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.issues });
    return;
  }

  try {
    const { key, validation } = await orgApiKeysService.createKey(
      ctx.organizationId,
      ctx.userId,
      parsed.data
    );

    // Audit log — never include the raw API key
    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        resource: 'OrganizationApiKey',
        action: 'CREATE',
        newData: {
          provider: key.provider,
          label: key.label,
          keyHint: key.keyHint,
          status: key.status,
          isDefault: key.isDefault,
        },
      },
    });

    res.status(201).json({
      success: true,
      data: { key, validation },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: `An API key with label "${req.body.label}" already exists for provider "${req.body.provider}".`,
      });
      return;
    }
    console.error('[OrgApiKeys] createKey error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// ── PUT /api/v1/orgs/api-keys/:id ─────────────────────────────────────────────
export const updateKey = async (req: Request, res: Response): Promise<void> => {
  const ctx = getOrgAndUser(req);
  if (!ctx) { res.status(400).json({ success: false, message: 'X-Organization-ID header is required' }); return; }

  const id = getParam(req, 'id');
  const parsed = updateOrgApiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.issues });
    return;
  }

  try {
    const updated = await orgApiKeysService.updateKey(id, ctx.organizationId, parsed.data);

    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        resource: 'OrganizationApiKey',
        action: 'UPDATE',
        newData: { id, ...parsed.data },
      },
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// ── DELETE /api/v1/orgs/api-keys/:id ──────────────────────────────────────────
export const deleteKey = async (req: Request, res: Response): Promise<void> => {
  const ctx = getOrgAndUser(req);
  if (!ctx) { res.status(400).json({ success: false, message: 'X-Organization-ID header is required' }); return; }

  const id = getParam(req, 'id');

  try {
    const deleted = await orgApiKeysService.deleteKey(id, ctx.organizationId);

    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        resource: 'OrganizationApiKey',
        action: 'DELETE',
        oldData: { id, ...deleted },
      },
    });

    res.status(200).json({ success: true, message: 'API key deleted successfully' });
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// ── POST /api/v1/orgs/api-keys/:id/validate ───────────────────────────────────
export const validateKey = async (req: Request, res: Response): Promise<void> => {
  const ctx = getOrgAndUser(req);
  if (!ctx) { res.status(400).json({ success: false, message: 'X-Organization-ID header is required' }); return; }

  const id = getParam(req, 'id');

  try {
    const result = await orgApiKeysService.validateStoredKey(id, ctx.organizationId);

    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        resource: 'OrganizationApiKey',
        action: 'VALIDATE',
        newData: { id, valid: result.valid, message: result.message },
      },
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// ── POST /api/v1/orgs/api-keys/:id/default ────────────────────────────────────
export const setDefault = async (req: Request, res: Response): Promise<void> => {
  const ctx = getOrgAndUser(req);
  if (!ctx) { res.status(400).json({ success: false, message: 'X-Organization-ID header is required' }); return; }

  const id = getParam(req, 'id');

  try {
    const updated = await orgApiKeysService.setDefaultKey(id, ctx.organizationId);

    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        resource: 'OrganizationApiKey',
        action: 'SET_DEFAULT',
        newData: { id, provider: updated.provider, label: updated.label },
      },
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Internal server error' });
  }
};
