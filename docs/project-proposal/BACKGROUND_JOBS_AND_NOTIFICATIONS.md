# Background Jobs & Notifications — AI Enterprise Automation Platform

---

## 1. Architecture Choice: PostgreSQL-Backed Queue

The platform uses a **PostgreSQL-backed job queue** (`PostgresQueueProvider`), not Redis/BullMQ or any external message broker.

**Why PostgreSQL?**
- No additional infrastructure required (PostgreSQL is already a dependency)
- ACID guarantees on job state transitions
- Queryable job history (no need for separate monitoring tools)
- Simpler deployment for small-to-medium workloads
- Visibility via pgAdmin or any PostgreSQL client

**Trade-offs vs Redis/BullMQ:**
- Higher polling latency (10-second intervals vs sub-second)
- Not suitable for extremely high-throughput job processing
- Polling creates minor database load at scale

---

## 2. PostgresQueueProvider Implementation

File: `apps/backend/src/services/jobs/postgres-queue.provider.ts`

```typescript
class PostgresQueueProvider extends JobQueueProvider {
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null
  private handlers: Map<string, (job: Job) => Promise<void>> = new Map()

  // Create a new job
  async enqueue(type: string, payload: any, options?: EnqueueOptions): Promise<Job>

  // Register a job handler function
  process(type: string, handler: (job: Job) => Promise<void>): void

  // Start the polling loop
  async start(): Promise<void>  // setInterval every 10,000ms

  // Poll for pending jobs (called every 10s)
  private async poll(): Promise<void>

  // Execute a single job
  private async executeJob(job: Job): Promise<void>

  // Reset a failed job for retry
  async retry(id: string): Promise<boolean>
}
```

---

## 3. BackgroundJob Data Model

```prisma
model BackgroundJob {
  id             String    @id @default(uuid())
  organizationId String?   // Optional org scope
  type           String    // Job type identifier (e.g., 'SEND_EMAIL')
  payload        Json?     // Job-specific data
  status         String    @default("PENDING")  // PENDING | RUNNING | COMPLETED | FAILED
  attempts       Int       @default(0)           // How many times executed
  maxAttempts    Int       @default(3)           // Max retries before FAILED
  error          String?                         // Last error message
  startedAt      DateTime?                       // When RUNNING began
  completedAt    DateTime?                       // When finished

  organization Organization? @relation(...)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, createdAt])
}
```

---

## 4. Job Lifecycle

```
enqueue() called
      ↓
Status: PENDING (created in DB)
      ↓
poll() finds PENDING jobs (every 10s)
      ↓
Optimistic lock: updateMany { where: {id, status: 'PENDING'}, data: {status: 'RUNNING', attempts: +1} }
      ↓
If updated.count > 0 (we won the lock):
      ↓
handler(job) called
      ↓
  ┌── Success ──┐     ┌── Failure ──────────────────────────────────┐
  ↓             ↓     ↓                                             ↓
Status:       Error   attempts < maxAttempts?                  attempts >= maxAttempts?
COMPLETED           Status: PENDING (retry on next poll)       Status: FAILED
```

### Optimistic Locking
The `updateMany` with `where: { status: 'PENDING' }` ensures that if two worker instances run simultaneously (e.g., during restart), only one wins the job:
```typescript
const updated = await prisma.backgroundJob.updateMany({
  where: { id: job.id, status: 'PENDING' },
  data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } }
});
if (updated.count > 0) {
  await this.executeJob(job);  // Only process if we won the lock
}
```

---

## 5. Job Types

| Type | Description | Payload Fields |
|---|---|---|
| `SEND_EMAIL` | Send an email via SMTP | `to`, `subject`, `body` |
| (extensible) | New types can be registered via `queue.process('TYPE', handler)` | — |

New job types can be added by:
1. Calling `jobQueueService.queue.process('NEW_TYPE', async (job) => { ... })` in `index.ts`
2. Enqueuing via `jobQueueService.queue.enqueue('NEW_TYPE', payload)`

---

## 6. Enqueue API

```
POST /api/v1/jobs
Authorization: Bearer <token>
X-Organization-ID: <orgId>

{
  "type": "SEND_EMAIL",
  "payload": {
    "to": "user@example.com",
    "subject": "Report Ready"
  }
}

Response:
{
  "success": true,
  "data": {
    "id": "abc-123",
    "status": "PENDING",
    "type": "SEND_EMAIL",
    "attempts": 0,
    "maxAttempts": 3,
    "createdAt": "2026-08-15T..."
  }
}
```

---

## 7. List/Status API

```
GET /api/v1/jobs
Authorization: Bearer <token>
X-Organization-ID: <orgId>

Query parameters:
  ?status=PENDING|RUNNING|COMPLETED|FAILED
  ?limit=25
  ?offset=0

Response:
{
  "success": true,
  "data": {
    "jobs": [ ... ],
    "total": 42
  }
}
```

---

## 8. Notification Data Model

```prisma
model Notification {
  id             String  @id @default(uuid())
  organizationId String
  userId         String?    // If null, org-wide notification
  type           String     // SUCCESS | ERROR | INFO | WARNING
  title          String
  message        String
  isRead         Boolean @default(false)

  organization Organization @relation(...)

  createdAt DateTime @default(now())
}
```

---

## 9. Notification Bell

The frontend header shows a notification bell with an unread count badge.

### Fetch Notifications
```
GET /api/v1/notifications
Authorization: Bearer <token>
X-Organization-ID: <orgId>

Response:
{
  "success": true,
  "data": {
    "notifications": [ ... ],
    "unreadCount": 3
  }
}
```

### Mark as Read
```
PUT /api/v1/notifications/:id/read
```

---

## 10. Notification Types

| Type | Icon Color | Use Case |
|---|---|---|
| `SUCCESS` | Green | Job completed, workflow executed successfully |
| `ERROR` | Red | Job failed, workflow error |
| `INFO` | Blue | Informational updates |
| `WARNING` | Yellow | Non-critical warnings |

---

## 11. Worker Startup

The background worker starts automatically when the backend starts:

```typescript
// apps/backend/src/index.ts
import { jobQueueService } from './services/jobs/job-queue.service';

// Register handlers
jobQueueService.queue.process('SEND_EMAIL', async (job) => {
  await sendEmail(job.payload.to, job.payload.subject, job.payload.body);
});

// Start polling
jobQueueService.queue.start();
// Console: [PostgresQueue] Started polling for background jobs.
```

The worker logs all activity to the Pino logger.
