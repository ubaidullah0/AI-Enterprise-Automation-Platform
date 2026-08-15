import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { requireOrgHeader } from '../utils/requestHelpers';
import { jobQueueService } from '../services/jobs/job-queue.service';
import { notificationService } from '../services/notification.service';

// ─── GET /api/v1/jobs ─────────────────────────────────────────────────────────
export const getJobs = async (req: Request, res: Response) => {
  try {
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    const jobs = await prisma.backgroundJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.status(200).json({ success: true, data: jobs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/v1/jobs/:id/retry ──────────────────────────────────────────────
export const retryJob = async (req: Request, res: Response) => {
  try {
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    const id = req.params.id as string;

    // Verify ownership
    const job = await prisma.backgroundJob.findFirst({
      where: { id, organizationId }
    });

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const success = await jobQueueService.queue.retry(id);
    if (!success) {
      return res.status(400).json({ success: false, message: 'Job cannot be retried (not FAILED)' });
    }

    res.status(200).json({ success: true, message: 'Job queued for retry' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/v1/jobs/test ───────────────────────────────────────────────────
export const createTestJob = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    // Enqueue a dummy test job
    await jobQueueService.queue.enqueue(
      'TEST_HEAVY_TASK',
      { userId, message: 'Testing the new job queue infrastructure' },
      { organizationId, maxAttempts: 1 }
    );

    // Also send an initial INFO notification just for demo
    await notificationService.notifyUser(
      userId,
      organizationId,
      'INFO',
      'Test Job Queued',
      'A heavy background job was just added to the queue.'
    );

    res.status(201).json({ success: true, message: 'Test job enqueued' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
