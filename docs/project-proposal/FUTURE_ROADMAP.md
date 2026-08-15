# Future Roadmap — AI Enterprise Automation Platform

This document outlines the current state of features within the platform, categorized by their implementation and verification status, and provides a roadmap for future development.

---

## 1. IMPLEMENTED (Fully Built and API-Verified)

These features have been completely built, their APIs have been tested, and automated backend verification has passed.

- **Authentication System:** Registration, Login, JWT access (15m) and refresh (7d) token flow.
- **OTP Password Reset (Backend):** 6-digit OTP generation, bcrypt hashing, 10-minute expiry, rate limiting (3/15m), brute-force protection (5 attempts max), and short-lived reset token issue.
- **Multi-Tenancy:** Complete isolation of resources via `organizationId` and `X-Organization-ID` header enforcement.
- **RBAC:** Four-tier role hierarchy (OWNER, ADMIN, MANAGER, MEMBER) with endpoint-level permission checks.
- **Organization Management:** Creation of workspaces and auto-assignment of the OWNER role.
- **AI Assistant Backend:** Support for OpenAI (gpt-4o), Ollama (local), and Gemini via a unified abstraction layer.
- **AI SSE Streaming:** Server-Sent Events endpoint (`/api/v1/ai/chat/stream`) verified to return chunked tokens.
- **Native Workflow Builder:** API endpoints for creating, saving canvas layouts (nodes/edges), and execution leading to `WorkflowRun` generation.
- **n8n Integration:** Proxy endpoints for workflow creation in n8n and returning `n8nWorkflowId`.
- **AI Workflow Generation:** Natural language prompt processing that returns valid React Flow JSON node/edge structure, along with AuditLog creation (`AI_WORKFLOW_GENERATED`).
- **Webhook Triggers:** Generation of 16-byte random hex tokens and the unauthenticated `POST /api/v1/webhooks/:token` trigger endpoint.
- **Analytics:** Data aggregation for KPIs, usage metrics, and multi-service health checks (PG, Redis, MinIO, AI).
- **Audit & Compliance:** Tamper-evident logging of CREATE, DELETE, and UPLOAD actions, OWNER/ADMIN filtering, and CSV export functionality.
- **Document Storage:** MinIO S3-compatible upload, metadata storage in PostgreSQL, presigned download URLs, and complete deletion lifecycle.
- **Notifications:** API endpoints for fetching notifications and calculating unread counts.
- **Background Jobs:** `PostgresQueueProvider` implementation, polling logic, and state transitions (PENDING → RUNNING → COMPLETED).
- **API Key Management:** AES-256-GCM encryption of org-specific AI provider keys.

---

## 2. PARTIALLY VERIFIED (Requires Browser Automation/Manual UI Testing)

These features are fully implemented in the codebase but cannot be verified automatically via backend API scripts. They require a browser environment (DOM manipulation, visual rendering, or external live systems).

- **OTP Live Email Flow:** The backend logic is verified and the Nodemailer SMTP connection is configured, but intercepting the live email in an inbox to extract the OTP programmatically during a test run is not currently implemented (requires a mock inbox like MailHog).
- **Browser SSE Streaming UI:** The backend correctly emits SSE headers and tokens, but the React progressive rendering of those tokens in the Assistant chat window is untested.
- **React Flow UI Interactions:** Dragging, dropping, and connecting nodes on the visual canvas cannot be tested via API scripts.
- **Webhook Active-Workflow Flow:** The trigger endpoint works, but verifying the rejection of inactive workflows requires manually toggling the `isActive` state in the UI first.
- **AI Generation Preview Screen:** The backend returns the correct JSON, but the React preview modal showing the explanation and node layout before the user clicks "Approve & Build" is untested.
- **Analytics Charts:** Recharts SVG rendering.
- **Audit Log Table & JSON Diff:** Browser interaction with filters and the side-by-side JSON diff modal.
- **Browser Notification Bell:** DOM updates for the unread count badge.

---

## 3. FUTURE PROPOSALS (Not Implemented)

These features represent the next phase of enterprise maturity for the platform.

### Storage & Documents
- **Folder Hierarchy:** Allow organizing MinIO documents into virtual folders.
- **File Versioning:** Support uploading new versions of existing documents.
- **Document Permissions:** Granular access control per document (beyond standard org-wide MEMBER access).
- **OCR / Text Extraction:** Automatically extract text from uploaded PDFs/images via a background job.
- **Semantic Search / RAG:** Index document text using `pgvector` to allow the AI Assistant to query uploaded organization knowledge.

### Automation & Workflows
- **Cron Scheduling:** Allow native workflows to trigger on a time schedule, not just via webhook or manual execution.
- **Expanded Node Library:** Add native nodes for Slack, Teams, database queries, and conditional loops.

### DevOps & Infrastructure
- **Prometheus Metrics:** Expose an `/metrics` endpoint for advanced monitoring and Grafana dashboarding.
- **CI/CD Pipeline:** Implement GitHub Actions for automated linting, building, and testing.
- **Multi-Region Deployment:** Strategy for synchronizing PostgreSQL and MinIO across geographical regions for HA.
- **Automated Backup/Restore Scripts:** Standardized bash scripts for taking pg_dumps and MinIO snapshots.

### Testing
- **Playwright E2E Suite:** Automate the browser to cover all items currently in the "Partially Verified" list.
- **Jest Test Suite:** Comprehensive unit and integration tests for the `WorkflowEngine` and backend services.

### Enterprise Features
- **SAML / SSO:** Integration with Okta, Azure AD, or Google Workspace for enterprise login.
- **Custom Branding:** Allow organizations to change the logo and primary colors of their dashboard.
