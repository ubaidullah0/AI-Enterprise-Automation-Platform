import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { n8nService } from '../services/n8n.service';
import { requireOrgHeader, getParam } from '../utils/requestHelpers';
import { workflowEngine } from '../services/workflow-engine.service';
import { aiWorkflowGenerator } from '../services/ai-workflow-generator.service';
import crypto from 'crypto';

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

// ─── POST /api/v1/workflows/:id/deactivate ────────────────────────────────────
export const deactivateWorkflow = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    const workflow = await prisma.workflow.findFirst({ where: { id, organizationId } });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

    if (workflow.engine === 'n8n' && workflow.n8nWorkflowId) {
      await n8nService.deactivateWorkflow(workflow.n8nWorkflowId);
    }

    const updated = await prisma.workflow.update({
      where: { id },
      data: { isActive: false }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/v1/workflows/generate ───────────────────────────────────────────
export const generateWorkflow = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    await checkOrgAccess(userId, organizationId);

    const { prompt, provider } = req.body;
    if (!prompt) return res.status(400).json({ success: false, message: 'Prompt is required' });

    // AI generation
    const generated = await aiWorkflowGenerator.generateWorkflowFromJson(prompt, provider || 'openai');

    // Return only the JSON so the UI can do Preview-and-Confirm
    res.status(200).json({
      success: true,
      data: {
        ...generated,
        aiGenerated: true,
        aiPrompt: prompt,
        aiProvider: provider || 'openai',
      }
    });
  } catch (error: any) {
    console.error('Generate workflow error', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
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

    const { 
      name, description, engine, 
      nodes, edges, triggerType,
      aiGenerated, aiPrompt, aiExplanation, aiProvider, aiModel 
    } = req.body as any;
    if (!name) return res.status(400).json({ success: false, message: 'Workflow name is required' });

    const selectedEngine = engine === 'n8n' ? 'n8n' : 'native';
    let n8nWorkflowId: string | null = null;
    let resolvedEngine = selectedEngine;

    if (selectedEngine === 'n8n') {
      try {
        const n8nResult = await n8nService.createWorkflow(`[${organizationId.slice(0, 8)}] ${name}`) as any;
        n8nWorkflowId = String(n8nResult.id);
      } catch (n8nError: any) {
        // n8n is optional — if not configured, silently save as native workflow
        console.warn('[n8n] Not available, falling back to native engine:', n8nError?.message);
        resolvedEngine = 'native'; // degrade to native so frontend shows Edit button
      }
    }

    const workflow = await prisma.workflow.create({
      data: {
        organizationId,
        name,
        description: description ?? null,
        n8nWorkflowId,
        engine: resolvedEngine,
        webhookToken: resolvedEngine === 'native' ? crypto.randomBytes(16).toString('hex') : null,
        createdBy: userId,
        nodes: nodes ? nodes : undefined,
        edges: edges ? edges : undefined,
        triggerType: triggerType || undefined,
        aiGenerated: !!aiGenerated,
        aiPrompt: aiPrompt || undefined,
        aiExplanation: aiExplanation || undefined,
        aiProvider: aiProvider || undefined,
        aiModel: aiModel || undefined,
      }
    });

    const actionType = aiGenerated ? 'AI_WORKFLOW_GENERATED' : 'CREATE';
    await prisma.auditLog.create({
      data: { 
        userId, 
        organizationId, 
        resource: 'Workflow', 
        action: actionType, 
        newData: { workflowId: workflow.id, name, aiPrompt } 
      }
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

// ─── PUT /api/v1/workflows/:id/canvas ─────────────────────────────────────────
export const updateCanvas = async (req: Request, res: Response) => {
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

    const { nodes, edges, isActive } = req.body;
    
    // Manage version history (store last 5 versions)
    const currentVersions = Array.isArray(workflow.versions) ? workflow.versions : [];
    const newVersion = {
      timestamp: new Date(),
      nodes: workflow.nodes,
      edges: workflow.edges
    };
    const updatedVersions = [newVersion, ...currentVersions].slice(0, 5); // Keep last 5

    const updated = await prisma.workflow.update({
      where: { id },
      data: {
        nodes: nodes || workflow.nodes,
        edges: edges || workflow.edges,
        isActive: isActive !== undefined ? isActive : workflow.isActive,
        versions: updatedVersions,
      }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/v1/workflows/:id/execute ───────────────────────────────────────
export const executeNativeWorkflow = async (req: Request, res: Response) => {
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
    
    if (workflow.engine !== 'native') {
      return res.status(400).json({ success: false, message: 'This workflow is not a native workflow' });
    }

    const result = await workflowEngine.execute(id, req.body || {});
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    console.error(error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};
