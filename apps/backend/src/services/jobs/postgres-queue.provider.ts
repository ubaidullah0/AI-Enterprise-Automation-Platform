import { JobQueueProvider, Job, EnqueueOptions } from './job-queue.interface';
import { prisma } from '../../utils/prisma';

export class PostgresQueueProvider extends JobQueueProvider {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private handlers: Map<string, (job: Job) => Promise<void>> = new Map();

  async enqueue(type: string, payload: any, options?: EnqueueOptions): Promise<Job> {
    const record = await prisma.backgroundJob.create({
      data: {
        type,
        payload,
        status: 'PENDING',
        maxAttempts: options?.maxAttempts ?? 3,
        organizationId: options?.organizationId,
      }
    });
    return record as Job;
  }

  process(type: string, handler: (job: Job) => Promise<void>, concurrency: number = 1): void {
    this.handlers.set(type, handler);
  }

  async retry(id: string): Promise<boolean> {
    const job = await prisma.backgroundJob.findUnique({ where: { id } });
    if (!job || job.status !== 'FAILED') return false;

    await prisma.backgroundJob.update({
      where: { id },
      data: { status: 'PENDING', attempts: 0, error: null }
    });
    return true;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Poll every 10 seconds as requested
    this.intervalId = setInterval(() => this.poll(), 10000);
    console.log('[PostgresQueue] Started polling for background jobs.');
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[PostgresQueue] Stopped polling.');
  }

  private async poll() {
    if (this.handlers.size === 0) return;

    try {
      // Find one pending job that we have a handler for
      // Prisma doesn't support SELECT FOR UPDATE SKIP LOCKED natively in findFirst
      // But we can do a quick check and optimistic update.
      const types = Array.from(this.handlers.keys());
      
      const jobs = await prisma.backgroundJob.findMany({
        where: {
          status: 'PENDING',
          type: { in: types }
        },
        orderBy: { createdAt: 'asc' },
        take: 5
      });

      for (const job of jobs) {
        // Optimistic lock
        const updated = await prisma.backgroundJob.updateMany({
          where: { id: job.id, status: 'PENDING' },
          data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } }
        });

        if (updated.count > 0) {
          await this.executeJob(job as Job);
        }
      }
    } catch (error) {
      console.error('[PostgresQueue] Polling error:', error);
    }
  }

  private async executeJob(job: Job) {
    const handler = this.handlers.get(job.type);
    if (!handler) return;

    try {
      await handler(job);
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', completedAt: new Date() }
      });
    } catch (error: any) {
      const isFinalAttempt = (job.attempts + 1) >= job.maxAttempts;
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: isFinalAttempt ? 'FAILED' : 'PENDING',
          error: error.message || String(error)
        }
      });
    }
  }
}
