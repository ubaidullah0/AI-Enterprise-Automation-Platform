# Testing & Verification — AI Enterprise Automation Platform

---

## 1. Available Validation Commands

The platform includes several scripts and commands to validate the codebase statically and at build-time.

```powershell
# 1. Backend TypeScript Analysis (no output if clean)
cd apps/backend
npx tsc --noEmit

# 2. Frontend TypeScript Analysis (no output if clean)
cd apps/frontend
npx tsc -b

# 3. Prisma Schema Validation
cd apps/backend
npx prisma validate

# 4. Code Linting (from root)
npm run lint

# 5. Production Builds
cd apps/backend && npm run build
cd apps/frontend && npm run build
```

---

## 2. API Verification Scripts

Two scripts are provided in the `scratch/` directory to automate API-level smoke testing. They simulate user behavior directly against the backend API without a browser.

### Basic Smoke Test
```powershell
node scratch/smoketest.js
```
**Tests:** Registration, Login, Organization verification.

### Advanced End-to-End Verification
```powershell
$env:TEST_MODE="true"; node scratch/smoketest-advanced.js
```
**Tests:**
- Auth (Register, Login, RBAC OWNER check)
- Native Workflows (Create, Save Canvas, Reload, Execute)
- Webhooks (Token generation, endpoint ping)
- n8n (Proxy creation)
- Analytics (Overview data, Health check)
- Audit (Log fetch, count)
- Notifications (Fetch success)
- Documents (List success)
- Background Jobs (Enqueue `SEND_EMAIL` job, check `PENDING` status)
- AI Generation (Prompt → JSON response check)
- RBAC Enforcement (Rejection without headers)

---

## 3. TEST_MODE for Email Safety

To test email flows safely (OTP and Welcome emails) without causing bounces from dummy addresses:

```env
TEST_MODE=true
```

When `TEST_MODE=true` is set, the `email.service.ts` will **intercept and discard** any emails sent to `@example.com` or `@test.com`. The service returns `true` (success) to the caller, allowing the flow to continue normally.

**Important:** Never enable `TEST_MODE` in production. It is explicitly designed for local smoke tests.

---

## 4. API Verification Results

The backend APIs have been thoroughly verified via automated testing.

| Area | Status | Verified Component |
|---|---|---|
| **Auth** | PASS | Registration, Login, JWT generation |
| **RBAC** | PASS | Organization header enforcement, OWNER auto-assigned |
| **Native Workflows** | PASS | Create, save canvas, node/edge persistence, run creation |
| **n8n** | PASS | Proxy creation, n8nWorkflowId generation |
| **Analytics** | PASS | Overview aggregation, Health checks (PG, Redis, MinIO) |
| **Audit** | PASS | OWNER/ADMIN restriction, log fetch, CSV export |
| **Documents** | PASS | MinIO upload, PostgreSQL metadata, MinIO delete |
| **Notifications** | PASS | API fetch, unread count |
| **Jobs** | PASS | Enqueue, `PostgresQueueProvider` polling, `COMPLETED` state |
| **AI Generation** | PASS | Prompt → valid React Flow JSON, Audit log creation |
| **AI Assistant** | PASS | Chat endpoint, SSE streaming endpoint |
| **Webhooks** | PARTIAL | Token generated, endpoint pinged; requires `isActive=true` manually |

---

## 5. Known Verification Gaps (UI & Browser)

Certain user-facing flows cannot be automated via Node.js scripts because they require browser interactions, visual rendering, or live email inbox access.

These flows are **implemented in code but UNTESTED visually**:

1. **OTP Password Reset (Live):** Backend logic verified, but full flow requires intercepting a real email inbox.
2. **AI SSE Streaming UI:** Backend SSE headers verified, but React progressive rendering is untested.
3. **React Flow Visual Canvas:** Backend node persistence verified, but drag-and-drop canvas interaction requires a browser.
4. **AI Generation Preview UI:** Backend returns correct JSON, but the React preview screen before approval is untested.
5. **Analytics Charts:** Backend data aggregation verified, but Recharts visual rendering is untested.
6. **Audit Table UI:** API verified, but browser table/filter interactions are untested.
7. **CSV Download via Browser:** API endpoint verified, but browser `Blob` download behavior is untested.
8. **Notification Bell:** API verified, but DOM badge updates are untested.
9. **Multi-User Invitations:** Requires complex session state switching.

---

## 6. How to Run a Local Manual Test

To manually verify the gaps above:

1. Start all Docker infrastructure (`docker compose up -d`)
2. Start the backend (`cd apps/backend; npm run dev`)
3. Start the frontend (`cd apps/frontend; npm run dev`)
4. Open http://localhost:5174 in your browser
5. Create an account
6. Click around the dashboard to verify visual rendering
7. Open the Visual Builder and test node connections
8. Open the AI Assistant and verify SSE token streaming

---

## 7. Future Test Strategy Recommendations

To achieve 100% verification in the future, the following test suites should be implemented:

1. **Playwright (E2E):** For React Flow interactions, chart rendering, and DOM updates.
2. **Jest (Unit):** For the `WorkflowEngine` node handlers and `analytics.service.ts` calculations.
3. **Supertest (Integration):** To replace the custom `smoketest.js` with structured API tests.
4. **MailHog / Mailpit:** Add to Docker Compose to trap and assert OTP emails locally.
