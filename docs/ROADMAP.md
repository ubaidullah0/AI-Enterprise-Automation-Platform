# Project Roadmap — AI Enterprise Automation Platform

> Status: v1.0.0 released (2026-08-18)

---

## Current Release: v1.0.0 — Foundation

### ✅ Completed Features
- Multi-tenant organization management with RBAC (OWNER/ADMIN/MANAGER/MEMBER)
- JWT authentication with refresh tokens + OTP password reset
- AI Assistant: OpenAI GPT-4o + Google Gemini 2.0 Flash + Ollama (local)
- SSE token streaming chat
- Org-level AI API key management with AES-256-GCM encryption
- Native visual workflow builder (@xyflow/react drag-and-drop canvas)
- Workflow execution engine (BFS-based node executor)
- n8n integration (create, trigger, delete workflows)
- AI workflow generation from natural language prompts
- Document storage via MinIO (S3-compatible)
- Full audit logging with CSV export
- Analytics dashboard (usage timeseries, provider breakdown, top users)
- PostgreSQL background job queue
- In-app notification system
- Mobile-responsive UI (dark mode)
- Docker infrastructure (PostgreSQL, Redis, n8n, MinIO, Nginx)
- Security: Helmet, CORS, bcrypt, no hardcoded secrets
- Vercel (frontend) + Render (backend) cloud deployment

---

## Phase A — Stability & Polish (Next Sprint)
**Priority: High | Effort: Low-Medium**

| Task | Description | Status |
|------|-------------|--------|
| Fix simulated health checks | Live Redis, MinIO, n8n pings in platform health endpoint | ❌ TODO |
| Global HTTP rate limiting | Add express-rate-limit on all routes (100 req/15min) | ❌ TODO |
| Swagger API paths | Fill in actual path definitions in swaggerDocument | ❌ TODO |
| Light mode theme | Connect theme toggle to TailwindCSS dark class system | ❌ TODO |
| AI usage cost breakdown | Per-provider cost display in analytics | ❌ TODO |
| File type validation | Restrict uploads to safe MIME types | ❌ TODO |
| Input sanitization | DOMPurify for user-generated content rendering | ❌ TODO |

---

## Phase B — Security Hardening (Q3 2026)
**Priority: High | Effort: Medium**

| Task | Description |
|------|-------------|
| Auth rate limiting | Max 5 failed login attempts → 15 min lockout |
| Account lockout | Progressive delay on repeated failures |
| CSRF protection | SameSite cookie + CSRF token for state-changing requests |
| IP-based rate limiting | Per-IP limits via Redis |
| Security headers audit | CSP, HSTS, X-Frame-Options tightening |
| Session invalidation | Server-side token revocation list |
| 2FA / TOTP | Optional two-factor authentication for users |

---

## Phase C — Advanced AI & Agentic Capabilities (Q3-Q4 2026)
**Priority: Medium | Effort: High**

| Task | Description |
|------|-------------|
| Agentic AI executor | AI can trigger workflows on user command ("Run my email automation") |
| RAG (Document Q&A) | Upload PDFs → AI can answer questions from them via embeddings |
| Anthropic Claude | Add Claude 3.5 Sonnet/Haiku provider support |
| Azure OpenAI | Backend support for Azure OpenAI endpoint |
| AI usage budgets | Per-org monthly spend caps with alerts |
| Custom system prompts | Per-organization AI personality configuration |
| Conversation sharing | Share chat conversations with team members |
| Prompt templates | Reusable prompt library |

---

## Phase D — Advanced Workflow Automation (Q4 2026)
**Priority: Medium | Effort: High**

| Task | Description |
|------|-------------|
| Workflow scheduler | Cron-based automatic workflow triggers |
| Workflow version history | See and restore previous versions of a workflow |
| More node types | Database query, Transform, Delay, Loop, Webhook send |
| Workflow templates | Pre-built workflow library |
| Embedded n8n canvas | Open n8n workflow editor directly inside the platform |
| Workflow sharing | Export/import workflow JSON files |
| Real-time execution logs | Live execution progress monitoring via WebSockets |
| Conditional branching | Visual if/else branching in native builder |

---

## Phase E — Enterprise RBAC (Q4 2026)
**Priority: Medium | Effort: Medium**

| Task | Description |
|------|-------------|
| SuperAdmin panel | Manage all organizations, users, usage from one admin view |
| Permission granularity | Fine-grained permissions beyond role names (e.g., "can_export") |
| SAML/SSO | Enterprise SSO login via Okta, Azure AD, Google Workspace |
| Organization audit dashboard | Admins can view cross-org usage |
| User suspension | Deactivate users without deleting their data |

---

## Phase F — Advanced Analytics (Q1 2027)
**Priority: Low | Effort: Medium**

| Task | Description |
|------|-------------|
| Real-time monitoring | WebSocket-based live execution progress |
| Cost budgeting | Set spending limits, receive alerts |
| Custom dashboards | Drag-and-drop analytics widget builder |
| Data export | Full data export for data ownership |
| Anomaly detection | Alert when AI usage spikes unexpectedly |

---

## Phase G — Production Hardening (Q1 2027)
**Priority: High (when scaling) | Effort: Medium**

| Task | Description |
|------|-------------|
| Docker Compose production | Separate production `docker-compose.prod.yml` with TLS |
| Kubernetes deployment | Helm chart for k8s deployment |
| Database backups | Automated PostgreSQL backup to S3 |
| Redis for job queue | Optional Redis migration for higher-throughput queuing |
| CDN for file downloads | CloudFront in front of MinIO for document delivery |
| Horizontal scaling | Stateless backend with Redis session sharing |
| Database read replicas | Read replica for analytics queries |

---

## Not Planned (Out of Scope)
- Replacing n8n with another automation engine
- Building a custom workflow scripting language
- Mobile native apps (iOS/Android)
- On-premise hardware support
- Replacing PostgreSQL with another database
