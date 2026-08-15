import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { workflowEngine } from '../services/workflow-engine.service';

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ success: false, message: 'Token required' });

    const workflow = await prisma.workflow.findUnique({
      where: { webhookToken: token as string }
    });

    if (!workflow) {
      return res.status(404).json({ success: false, message: 'Webhook not found' });
    }

    if (!workflow.isActive) {
      return res.status(400).json({ success: false, message: 'Workflow is not active' });
    }

    // Execute the workflow async so webhook responds fast
    // In a real system, we'd use a queue, but here we run it async
    workflowEngine.execute(workflow.id, {
      body: req.body,
      query: req.query,
      headers: req.headers
    }).catch(console.error);

    return res.status(202).json({ success: true, message: 'Workflow triggered' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
