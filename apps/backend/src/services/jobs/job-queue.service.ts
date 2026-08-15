import { JobQueueProvider } from './job-queue.interface';
import { PostgresQueueProvider } from './postgres-queue.provider';

class JobQueueService {
  private provider: JobQueueProvider;

  constructor() {
    // Here we can swap the provider based on environment variables if needed later
    // e.g. if (process.env.QUEUE_PROVIDER === 'redis') { ... } else { ... }
    this.provider = new PostgresQueueProvider();
  }

  get queue() {
    return this.provider;
  }
}

export const jobQueueService = new JobQueueService();
