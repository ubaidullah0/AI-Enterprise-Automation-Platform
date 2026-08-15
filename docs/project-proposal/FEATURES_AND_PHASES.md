# Features and Development Phases

This document describes the complete development history of the AI Enterprise Automation Platform, organized by phase. Each phase is listed with its goals, backend changes, frontend changes, database changes, and current verification status.

---

## Phase 1 — Foundation: Authentication & Multi-Tenancy

**Goal:** Establish the core authentication system, organization model, and RBAC.

### Backend Changes
- Express 5 server setup with Helmet, CORS, Pino logging
- Prisma schema: `User`, `Organization`, `OrganizationMember`, `OrganizationRole`, `SystemRole`
- Registration endpoint with transaction (create user + org + membership in one atomic operation)
- Login endpoint with bcrypt verification
- JWT access (15 min) + refresh (7 day) token generation
- `requireAuth` middleware for JWT verification
- `checkOrgAccess` helper for organization membership validation
- `X-Organization-ID` header enforcement
- `/api/v1/auth/me` endpoint returning user with memberships
- Swagger documentation setup
- Health check endpoint (`/api/v1/health`)

### Frontend Changes
- React 19 + Vite 8 + TypeScript 6 project setup
- TailwindCSS 3 styling
- React Router Dom 7 routing
- Login page
- Registration page
- Dashboard layout shell
- Auth state management with Zustand
- Axios API client in `src/lib/api.ts`

### Database Changes
- Initial schema: `User`, `Organization`, `OrganizationMember`, `OrganizationRole`, `SystemRole`, `OrganizationSetting`, `OrganizationInvitation`

### Verification Status
- ✅ Register, Login, JWT, OWNER role auto-assignment — API VERIFIED
- ✅ Organization isolation — API VERIFIED

---

## Phase 2 — AI Provider System & AI Assistant

**Goal:** Build the AI provider abstraction and conversational AI assistant with SSE streaming.

### Backend Changes
- `AIProvider` abstract class with `generateText`, `generateChatResponse`, `generateChatResponseWithUsage`, `streamChatResponse`
- `OllamaProvider` — HTTP calls to local Ollama
- `OpenAIProvider` — OpenAI SDK with token usage tracking
- `GeminiProvider` — Google Generative AI SDK with `usageMetadata` support
- `AIService` facade with `chat`, `chatWithUsage`, `streamChat`
- `POST /api/v1/ai/chat` — non-streaming endpoint
- `POST /api/v1/ai/chat/stream` — SSE streaming endpoint
- `GET /api/v1/ai/conversations` — conversation history
- `GET /api/v1/ai/providers` — list available/configured providers
- Token usage and cost estimation in `analytics.service.ts`
- Conversation and Message persistence in PostgreSQL

### Frontend Changes
- AI Assistant page (`/assistant`)
- Provider selection dropdown
- Chat interface with message history
- SSE streaming implementation (progressive token display)
- Markdown rendering via `react-markdown`

### Database Changes
- `Conversation` model (org/user scoped, provider)
- `Message` model (role, content, tokens, costUsd, latencyMs)

### Verification Status
- ✅ Backend chat endpoint — API VERIFIED
- ✅ Backend SSE stream endpoint — API VERIFIED (headers confirmed)
- ⚠️ Ollama — returns 500 when Ollama not running (expected behavior)
- ❌ Frontend SSE progressive UI — NOT TESTED (requires browser)

---

## Phase 3 — n8n Integration

**Goal:** Integrate with n8n for external workflow automation.

### Backend Changes
- `N8nService` using Axios
- Request interceptor to inject `N8N_API_KEY` dynamically at call time (not at module load)
- `createWorkflow` in n8n via proxy
- `POST /api/v1/workflows` with `engine: 'n8n'` triggers n8n creation
- `n8nWorkflowId` stored on `Workflow` model
- Graceful error handling when n8n is not running or API key missing

### Frontend Changes
- Workflow Dashboard (`/workflows`)
- n8n workflow creation option
- "Open in n8n" button linking to `N8N_URL/workflow/{n8nWorkflowId}`
- Workflow list with engine badge (native vs n8n)

### Database Changes
- `Workflow` model: `n8nWorkflowId`, `n8nWebhookUrl`, `engine` fields

### Verification Status
- ✅ n8n workflow creation API — VERIFIED
- ✅ n8nWorkflowId returned — VERIFIED
- ✅ n8n service accessible at port 5680 — VERIFIED

---

## Phase 4 — Organization API Key Management

**Goal:** Allow organizations to securely store and use their own AI provider API keys.

### Backend Changes
- `OrganizationApiKey` model with AES-256-GCM encryption
- `ENCRYPTION_KEY` environment variable (32-char hex)
- Only the last 4 chars (`keyHint`) stored in plaintext
- `POST /api/v1/org-api-keys` — create encrypted key
- `GET /api/v1/org-api-keys` — list keys (hints only, no plaintext)
- `DELETE /api/v1/org-api-keys/:id` — remove key
- Key activation/deactivation endpoints
- Provider validation before storage

### Frontend Changes
- Settings page → API Keys tab
- Key creation form with provider selection
- Key list showing hints and status
- Activate/deactivate controls

### Database Changes
- `OrganizationApiKey` model: provider, model, label, encryptedKey, keyHint, status, isDefault, createdBy, lastUsedAt, lastValidatedAt

### Verification Status
- ✅ Key storage and encryption — implementation verified in code
- ✅ OWNER/ADMIN restriction — verified in controller

---

## Phase 5 — Native Visual Workflow Builder

**Goal:** Build a drag-and-drop workflow canvas using React Flow with full persistence and execution.

### Backend Changes
- `WorkflowEngine` service with BFS graph traversal
- Node type handlers: `trigger_webhook`, `trigger_manual`, `action_email`, `action_http`, `action_ai`, `action_log`, `logic_condition`
- Template variable resolution: `{{nodeId.field}}`
- `PUT /api/v1/workflows/:id/canvas` — save nodes, edges, manage version history (last 5)
- `POST /api/v1/workflows/:id/execute` — execute workflow, create `WorkflowRun`
- `WorkflowRun` lifecycle: RUNNING → COMPLETED / FAILED
- Fixed: removed invalid `organizationId` from `WorkflowRun.create()` (not in schema)

### Frontend Changes
- `WorkflowBuilder` page (`/workflows/:id/edit`)
- React Flow canvas with custom node components
- Node type palette (sidebar)
- Edge connections
- Canvas save
- Node configuration panels
- Execution trigger button
- Run result display

### Database Changes
- `Workflow` model: `nodes` (JSON), `edges` (JSON), `versions` (JSON), `webhookToken`, `triggerType`
- `WorkflowRun` model: `workflowId`, `status`, `inputData`, `outputData`, `errorDetails`, `durationMs`, `triggeredBy`, `startedAt`, `completedAt`

### Verification Status
- ✅ Create workflow — API VERIFIED
- ✅ Save canvas (nodes + edges persist) — API VERIFIED
- ✅ Reload canvas — API VERIFIED, nodes array confirmed
- ✅ Execute workflow (WorkflowRun created) — API VERIFIED after Prisma fix
- ❌ React Flow drag/drop UI — NOT TESTED (requires browser)

---

## Phase 6 — Analytics & Audit Compliance

**Goal:** Provide platform analytics and a compliance-grade audit trail.

### Backend Changes
- `analytics.controller.ts`: `/overview` and `/health` endpoints
- Overview: conversations, messages, workflows, workflow runs, members, tokens, cost, latency
- Health: PostgreSQL, Redis, MinIO, n8n, OpenAI, Ollama connectivity checks
- `audit.controller.ts`: OWNER/ADMIN-only audit log access
- Filtering: resource, action, date range
- Pagination
- CSV export (Content-Type: text/csv)
- JSON diff in details response
- `estimateCost` function for token cost calculation

### Frontend Changes
- `AnalyticsDashboard` page (`/analytics`)
- KPI cards (Recharts)
- Workflow execution chart
- AI provider breakdown
- Token/cost display
- `AuditComplianceDashboard` page (`/audit`)
- Log table with filters
- View Details modal (JSON diff)
- CSV download button
- Fixed: React Hooks violation (useEffect after early return) — moved all hooks before any conditional return

### Database Changes
- `AuditLog` model: userId, organizationId, resource, action, oldData, newData, createdAt
- `ActivityLog` model: userId, organizationId, action, details

### Verification Status
- ✅ Analytics overview API — VERIFIED
- ✅ Health check API — VERIFIED
- ✅ Audit log fetch — VERIFIED
- ✅ OWNER/ADMIN restriction — VERIFIED
- ❌ Chart rendering — NOT TESTED (browser required)
- ❌ CSV download — NOT TESTED (browser required)

---

## Phase 7 — Document Storage (MinIO)

**Goal:** Enable organization-scoped file upload, download, and delete via MinIO.

### Backend Changes
- `StorageService` using AWS SDK S3 client targeting MinIO
- Org-scoped object path: `org/{organizationId}/{uuid}_{filename}`
- Multer middleware for multipart form handling
- `POST /api/v1/documents` — upload, store metadata, create AuditLog
- `GET /api/v1/documents` — list org documents
- `GET /api/v1/documents/:id/download` — generate presigned download URL
- `DELETE /api/v1/documents/:id` — delete from MinIO + PostgreSQL + AuditLog
- Bucket auto-creation on startup if configured

### Frontend Changes
- `DocumentManager` page (`/documents`)
- Drag-and-drop upload zone
- File list with size, type, date
- Download button (presigned URL)
- Delete button with confirmation

### Database Changes
- `Document` model: organizationId, uploadedBy, fileName, fileUrl, mimeType, size

### Verification Status
- ✅ Upload API — VERIFIED
- ✅ MinIO object creation — VERIFIED
- ✅ PostgreSQL metadata — VERIFIED
- ✅ AuditLog records — VERIFIED
- ✅ Delete (MinIO + PostgreSQL + AuditLog) — VERIFIED

---

## Phase 8 — Notifications & Background Jobs

**Goal:** Implement a PostgreSQL-backed background job queue and notification system.

### Backend Changes
- `JobQueueProvider` abstract interface
- `PostgresQueueProvider` implementation:
  - `enqueue(type, payload, options)` — create `PENDING` job
  - `process(type, handler)` — register job handler
  - `start()` — begin 10-second polling loop
  - `poll()` — optimistic lock via `updateMany` where status=PENDING
  - `executeJob()` — run handler, update to COMPLETED or retry
  - `retry(id)` — reset failed job to PENDING
- `JobQueueService` singleton using `PostgresQueueProvider`
- Worker starts automatically on server startup
- `POST /api/v1/jobs` — enqueue a job
- `GET /api/v1/jobs` — list jobs with status
- Notification service: create notifications for org/user
- `GET /api/v1/notifications` — with unread count
- `PUT /api/v1/notifications/:id/read` — mark as read

### Frontend Changes
- Notification Bell in dashboard header
- Unread count badge
- Notification dropdown panel
- `JobQueueManager` in Settings page
- Job status display (PENDING/RUNNING/COMPLETED/FAILED)

### Database Changes
- `BackgroundJob` model: type, payload, status, attempts, maxAttempts, error, startedAt, completedAt
- `Notification` model: organizationId, userId, type, title, message, isRead

### Verification Status
- ✅ PostgresQueueProvider — confirmed as active implementation
- ✅ Enqueue API — VERIFIED
- ✅ PENDING→RUNNING→COMPLETED cycle — VERIFIED via server logs
- ✅ Notifications API — VERIFIED
- ✅ Unread count — VERIFIED

---

## Phase 9 — AI Workflow Generation

**Goal:** Generate workflows from natural language via AI and import into the visual builder.

### Backend Changes
- `AIWorkflowGenerator` service — sends structured prompt to AI requesting React Flow JSON
- `POST /api/v1/workflows/generate` — returns `{nodes, edges, name, description, aiExplanation}`
- `createWorkflow` updated to accept `aiGenerated`, `aiPrompt`, `aiExplanation`, `aiProvider`, `aiModel`
- When `aiGenerated=true`: AuditLog records `AI_WORKFLOW_GENERATED` action
- AI metadata persisted on `Workflow` record

### Frontend Changes
- "Generate with AI" button in Workflow Dashboard
- Natural language prompt input
- AI generation loading state
- Preview screen: name, description, AI explanation, node preview
- "Approve & Build" button → creates workflow → opens builder

### Database Changes
- `Workflow` model additions: `aiGenerated`, `aiPrompt`, `aiExplanation`, `aiProvider`, `aiModel`

### Verification Status
- ✅ Generation endpoint returns valid nodes/edges — API VERIFIED
- ✅ AI_WORKFLOW_GENERATED in AuditLog — code verified
- ❌ Frontend preview screen — NOT TESTED (browser required)

---

## Phase 10 — OTP Password Reset

**Goal:** Implement a secure OTP-based password reset flow.

### Backend Changes
- `PasswordResetOtp` model in Prisma schema
- `POST /api/v1/auth/forgot-password-otp` — generate 6-digit OTP, bcrypt hash, store, email
  - Rate limit: max 3 OTPs per 15 minutes per user
  - Invalidates previous unused OTPs
  - OTP expires in 10 minutes
- `POST /api/v1/auth/verify-otp` — compare OTP
  - Max 5 failed attempts (brute-force guard)
  - Issues 15-minute `resetToken` on success
- `POST /api/v1/auth/reset-password-otp` — validate resetToken, update password (cost 12), mark OTP used
- `sendOtpEmail` in email service

### Frontend Changes
- "Forgot Password" link on login page → `/reset-password`
- Email input → OTP request
- OTP entry page (`/verify-otp`) — 6-digit input with auto-submit
- New password page (`/reset-password-new`)
- Success → redirect to login

### Database Changes
- `PasswordResetOtp` model: userId, email, otpHash, expiresAt, used, usedAt, attempts, resetToken, resetTokenExpiry

### Verification Status
- ✅ Backend implementation — code verified (all endpoints, logic, rate limiting)
- ❌ Live email flow — NOT TESTED (requires SMTP mock inbox)
- ❌ Frontend OTP UI — NOT TESTED (browser required)

---

## Phase 11 — Webhook Workflow Triggers

**Goal:** Allow native workflows to be triggered via HTTP webhook.

### Backend Changes
- `webhookToken` (16-byte random hex) auto-generated on native workflow creation
- `POST /api/v1/webhooks/:token` — webhook trigger endpoint (unauthenticated)
- Controller checks `workflow.isActive === true` before execution
- POST body, query, headers injected into execution context
- Execution happens asynchronously (202 Accepted response)
- `WorkflowRun` created and updated by the workflow engine

### Frontend Changes
- Webhook URL displayed in Workflow Dashboard
- Copy-to-clipboard button for webhook URL
- isActive toggle to enable/disable webhook acceptance

### Database Changes
- `Workflow` model: `webhookToken` (unique)

### Verification Status
- ✅ webhookToken generated — VERIFIED
- ✅ Endpoint exists and responds — VERIFIED
- ⚠️ isActive check — by design (inactive workflows return 400 "Workflow is not active")

---

## Phase 12 — Final Stabilization & Cleanup

**Goal:** Fix all bugs found during verification, ensure clean builds, and finalize the codebase.

### Backend Changes
- **email.service.ts**: Added `TEST_MODE=true` guard for dummy domain bypass — ensures production SMTP is never silently bypassed
- **workflow-engine.service.ts**: Removed invalid `organizationId` field from `WorkflowRun.create()` — field does not exist on the schema, was causing Prisma validation errors during execution

### Frontend Changes
- **AuditComplianceDashboard.tsx**: Fixed React Hooks violation — moved `useEffect` after all other hooks unconditionally (was after early RBAC return, violating Rules of Hooks)

### Build Verification
- Backend TypeScript: 0 errors
- Backend production build: PASS
- Frontend TypeScript: 0 errors
- Frontend production build: PASS (3181 modules)
- Prisma validation: PASS
- Lint: 0 errors, 7 non-blocking exhaustive-deps warnings

### Verification Status
- ✅ All builds passing
- ✅ Lint clean (7 warnings, all non-blocking)
- ✅ Email TEST_MODE guard confirmed correct
- ✅ WorkflowRun Prisma fix confirmed
