export interface Job {
  id: string;
  type: string;
  payload: any;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  attempts: number;
  maxAttempts: number;
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  organizationId?: string | null;
}

export interface EnqueueOptions {
  organizationId?: string;
  maxAttempts?: number;
}

export abstract class JobQueueProvider {
  /**
   * Add a new job to the queue.
   */
  abstract enqueue(type: string, payload: any, options?: EnqueueOptions): Promise<Job>;

  /**
   * Process jobs of a certain type using the provided handler.
   */
  abstract process(type: string, handler: (job: Job) => Promise<void>, concurrency?: number): void;

  /**
   * Retry a failed job.
   */
  abstract retry(id: string): Promise<boolean>;

  /**
   * Start the worker/poller.
   */
  abstract start(): Promise<void>;

  /**
   * Stop the worker/poller.
   */
  abstract stop(): Promise<void>;
}
