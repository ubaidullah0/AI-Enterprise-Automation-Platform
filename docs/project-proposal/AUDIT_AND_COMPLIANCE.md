# Audit & Compliance — AI Enterprise Automation Platform

---

## 1. Purpose and Overview

The Audit & Compliance feature provides a tamper-evident, filterable log of all significant actions taken within the platform. It enables organizations to:

- Track who did what, when, and on which resource
- Compare before/after states for all data changes
- Export compliance records as CSV
- Restrict access to authorized roles only (OWNER and ADMIN)

---

## 2. AuditLog Data Model

```prisma
model AuditLog {
  id             String  @id @default(uuid())
  organizationId String?   // Which organization the action occurred in
  userId         String?   // Who performed the action (null = system)
  resource       String    // e.g., "Workflow", "Document"
  action         String    // e.g., "CREATE", "DELETE", "UPLOAD"
  oldData        Json?     // State before the action
  newData        Json?     // State after the action

  user         User?         @relation(...)
  organization Organization? @relation(...)

  createdAt DateTime @default(now())
}
```

Audit log records are **append-only**. No update or delete endpoints exist.

---

## 3. Logged Events

| Resource | Action | When Triggered |
|---|---|---|
| Workflow | CREATE | Workflow created manually |
| Workflow | AI_WORKFLOW_GENERATED | AI-generated workflow confirmed by user |
| Workflow | DELETE | Workflow deleted |
| Document | UPLOAD | File uploaded to MinIO |
| Document | DELETE | File deleted from MinIO and database |
| Organization | (membership changes) | Members added/removed (where implemented) |

### Example: Workflow Created
```json
{
  "resource": "Workflow",
  "action": "CREATE",
  "newData": {
    "workflowId": "223bd9b5-...",
    "name": "Customer Onboarding",
    "aiPrompt": null
  }
}
```

### Example: AI Workflow
```json
{
  "resource": "Workflow",
  "action": "AI_WORKFLOW_GENERATED",
  "newData": {
    "workflowId": "abc123...",
    "name": "Welcome Email Workflow",
    "aiPrompt": "Send a welcome email when a new user signs up"
  }
}
```

### Example: Document Deleted
```json
{
  "resource": "Document",
  "action": "DELETE",
  "oldData": {
    "fileName": "Q3_Report.pdf",
    "size": 204800
  }
}
```

---

## 4. RBAC Enforcement

Access to audit logs is restricted to **OWNER** and **ADMIN** roles:

```typescript
// In audit.controller.ts
const membership = await prisma.organizationMember.findFirst({
  where: { userId, organizationId },
  include: { role: true }
});
const roleName = membership?.role?.name;

if (!roleName || !['OWNER', 'ADMIN'].includes(roleName)) {
  return res.status(403).json({
    success: false,
    message: 'Access denied. OWNER or ADMIN role required.'
  });
}
```

This check is enforced on **every** audit log request — both list and detail endpoints.

---

## 5. Filtering

The audit log supports multiple filter parameters:

| Parameter | Description | Example |
|---|---|---|
| `resource` | Filter by resource type | `?resource=Workflow` |
| `action` | Filter by action type | `?action=DELETE` |
| `userId` | Filter by user | `?userId=abc-123` |
| `dateFrom` | Start date (ISO 8601) | `?dateFrom=2026-08-01` |
| `dateTo` | End date (ISO 8601) | `?dateTo=2026-08-31` |
| `limit` | Page size | `?limit=25` |
| `offset` | Pagination offset | `?offset=50` |

---

## 6. Pagination

The audit log endpoint returns paginated results with metadata:

```json
{
  "success": true,
  "data": {
    "logs": [ ... ],
    "total": 342,
    "limit": 25,
    "offset": 0
  }
}
```

---

## 7. View Details (JSON Diff)

Each audit log entry can be expanded to view the full `oldData` and `newData`:

```
GET /api/v1/audit-logs/:id
→ Returns the full audit record including oldData and newData JSON
```

The frontend renders these as a side-by-side JSON diff view, highlighting changed fields.

---

## 8. CSV Export

The audit log can be exported as a downloadable CSV file:

```
GET /api/v1/audit-logs?format=csv
```

Response headers:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="audit-log-2026-08-15.csv"
```

CSV columns:
- `Date`
- `User`
- `Resource`
- `Action`
- `Old Data` (JSON stringified)
- `New Data` (JSON stringified)

---

## 9. Known Gaps

| Gap | Status |
|---|---|
| MANAGER/MEMBER limited view | Not implemented — full 403 for non-OWNER/ADMIN |
| Real-time audit log streaming | Not implemented — requires polling or SSE |
| Audit log for user login/logout events | Not implemented |
| Immutable storage backend | Logs are in PostgreSQL — could be augmented with append-only S3 archival |
| Browser UI table/filter interaction | NOT TESTED (browser required) |
| CSV download via browser | NOT TESTED (browser required — API endpoint is verified) |
