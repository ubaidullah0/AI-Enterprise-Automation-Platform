import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { n8nService } from '../services/n8n.service';
import { requireOrgHeader, getParam } from '../utils/requestHelpers';

// ─── Helper: verify org membership ───────────────────────────────────────────
const checkOrgAccess = async (userId: string, organizationId: string) => {
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } }
  });
  if (!membership) throw new Error('Forbidden: Not a member of this organization');
};

// ─── GET /api/v1/workflows ────────────────────────────────────────────────────
export const listWorkflows = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    await checkOrgAccess(userId, organizationId);

    const workflows = await prisma.workflow.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' }
    });

    res.status(200).json({ success: true, data: workflows });
  } catch (error: any) {
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/v1/workflows ───────────────────────────────────────────────────
export const createWorkflow = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    await checkOrgAccess(userId, organizationId);

    const { name, description } = req.body as { name?: string; description?: string };
    if (!name) return res.status(400).json({ success: false, message: 'Workflow name is required' });

    // Try to create in n8n (non-fatal if n8n is not running)
    let n8nWorkflowId: string | null = null;
    try {
      const n8nResult = await n8nService.createWorkflow(`[${organizationId.slice(0, 8)}] ${name}`);
      n8nWorkflowId = String(n8nResult.id);
    } catch (n8nError) {
      console.warn('Could not create workflow in n8n (is it running and API key configured?)');
    }

    const workflow = await prisma.workflow.create({
      data: {
        organizationId,
        name,
        description: description ?? null,
        n8nWorkflowId,
        createdBy: userId,
      }
    });

    await prisma.auditLog.create({
      data: { userId, organizationId, resource: 'Workflow', action: 'CREATE', newData: { workflowId: workflow.id, name } }
    });

    res.status(201).json({ success: true, data: workflow });
  } catch (error: any) {
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    console.error('Create workflow error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── DELETE /api/v1/workflows/:id ────────────────────────────────────────────
export const deleteWorkflow = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    await checkOrgAccess(userId, organizationId);

    const id = getParam(req, 'id');

    const workflow = await prisma.workflow.findUnique({ where: { id } });
    if (!workflow || workflow.organizationId !== organizationId) {
      return res.status(404).json({ success: false, message: 'Workflow not found' });
    }

    if (workflow.n8nWorkflowId) {
      try {
        await n8nService.deleteWorkflow(workflow.n8nWorkflowId);
      } catch (e) {
        console.warn('Failed to delete workflow in n8n:', e);
      }
    }

    await prisma.workflow.delete({ where: { id } });

    await prisma.auditLog.create({
      data: { userId, organizationId, resource: 'Workflow', action: 'DELETE', oldData: { workflowId: id, name: workflow.name } }
    });

    res.status(200).json({ success: true, message: 'Workflow deleted' });
  } catch (error: any) {
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
