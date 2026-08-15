# Project Proposal Documentation — Index

This folder contains the complete technical documentation, design decisions, and handoff materials for the **AI Enterprise Automation Platform**.

---

## Documents

| File | Description |
|---|---|
| [PROJECT_PROPOSAL.md](./PROJECT_PROPOSAL.md) | Full technical specification: architecture, goals, requirements, design decisions, all features |
| [FEATURES_AND_PHASES.md](./FEATURES_AND_PHASES.md) | Development history: all implemented phases, what was built, verification status |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture deep-dive: frontend, backend, AI, workflow engine, infrastructure |
| [SECURITY_AND_RBAC.md](./SECURITY_AND_RBAC.md) | Security model: JWT, RBAC, encryption, audit, OTP protection, SMTP safety |
| [AI_AND_AUTOMATION.md](./AI_AND_AUTOMATION.md) | AI provider abstraction, SSE streaming, workflow generation, n8n integration |
| [STORAGE_AND_DOCUMENTS.md](./STORAGE_AND_DOCUMENTS.md) | MinIO document storage, presigned URLs, upload/download/delete lifecycle |
| [AUDIT_AND_COMPLIANCE.md](./AUDIT_AND_COMPLIANCE.md) | Audit logs, RBAC enforcement, CSV export, JSON diff |
| [BACKGROUND_JOBS_AND_NOTIFICATIONS.md](./BACKGROUND_JOBS_AND_NOTIFICATIONS.md) | PostgreSQL job queue, notification system, job lifecycle |
| [TESTING_AND_VERIFICATION.md](./TESTING_AND_VERIFICATION.md) | Verification results, known gaps, test commands, future test strategy |
| [DEPLOYMENT_AND_OPERATIONS.md](./DEPLOYMENT_AND_OPERATIONS.md) | Production checklist, migrations, monitoring, backup |
| [FUTURE_ROADMAP.md](./FUTURE_ROADMAP.md) | Implemented features, verification gaps, future proposals |

---

## Quick Status

**Build Status:** All passing (TypeScript, Vite build, Prisma validation, 0 lint errors)

**Final Assessment:** READY WITH UNTESTED USER-FACING FLOWS

See [TESTING_AND_VERIFICATION.md](./TESTING_AND_VERIFICATION.md) for the complete verification table.
