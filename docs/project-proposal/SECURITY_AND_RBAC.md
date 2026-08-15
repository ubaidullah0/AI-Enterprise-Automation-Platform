# Security & RBAC — AI Enterprise Automation Platform

---

## 1. Authentication Security

### Password Hashing
All passwords are hashed using **bcrypt** before storage:
- Registration: cost factor **10**
- OTP-confirmed password reset: cost factor **12** (higher due to sensitivity of reset operation)
- Plaintext passwords are **never stored or logged**

### JWT Tokens
| Token | Secret | Expiry | Purpose |
|---|---|---|---|
| Access Token | `JWT_SECRET` | 15 minutes | API authorization |
| Refresh Token | `JWT_REFRESH_SECRET` | 7 days | Obtain new access tokens |

Tokens are signed with **HS256** (HMAC-SHA256). The JWT secret must be at least 32 characters in production.

### Token Verification
`requireAuth` middleware verifies the `Authorization: Bearer <token>` header on every protected route. Invalid or expired tokens return `401 Unauthorized`.

---

## 2. OTP Password Reset Security

The OTP password reset flow has multiple layers of security:

| Layer | Implementation |
|---|---|
| OTP Generation | `crypto.randomInt(100000, 999999)` — cryptographically secure |
| OTP Storage | bcrypt-hashed (`otpHash`) — plaintext OTP never stored |
| OTP Expiry | 10 minutes from generation |
| Rate Limiting | Max 3 OTP requests per 15 minutes per user |
| Invalidation | Previous unused OTPs invalidated when a new one is requested |
| Brute-force Guard | Max 5 failed verify attempts; OTP locked after 5th failure |
| Reset Token | 32-byte random hex; issued only after OTP verified; 15-minute expiry |
| Password Update | bcrypt cost 12; OTP record marked `used=true` in same transaction |
| Safe Response | `POST /auth/forgot-password-otp` always returns success (prevents email enumeration) |

---

## 3. Organization Isolation (Multi-Tenancy)

Every resource in the database has an `organizationId` foreign key:

```typescript
// Every protected controller does this:
const organizationId = requireOrgHeader(req);          // X-Organization-ID header
await checkOrgAccess(userId, organizationId);           // Verify membership
// Then all queries include:
prisma.workflow.findMany({ where: { organizationId } })
```

- Users can belong to multiple organizations
- Switching orgs sends a different `X-Organization-ID`
- A user can **never** access another org's data even if they know the organizationId

---

## 4. RBAC Roles

| Role | Created | Permissions |
|---|---|---|
| `OWNER` | Automatically on registration | `["*"]` — full access |
| `ADMIN` | Assigned by OWNER | Manage members, view audit, all resources |
| `MANAGER` | Assigned by OWNER/ADMIN | Workflows, documents, AI — no audit/settings |
| `MEMBER` | Default invitation role | Read-only + own AI usage |

### Permission Checks in Code
```typescript
// Audit logs — OWNER/ADMIN only
const membership = await prisma.organizationMember.findFirst({
  where: { userId, organizationId },
  include: { role: true }
});
if (!['OWNER', 'ADMIN'].includes(membership.role.name)) {
  return res.status(403).json({ success: false, message: 'Insufficient permissions' });
}
```

---

## 5. API Key Encryption

Organization AI provider keys are stored encrypted using **AES-256-GCM**:

- `ENCRYPTION_KEY` environment variable must be a 32-character hex string
- The full key is encrypted before storage in `OrganizationApiKey.encryptedKey`
- Only the last 4 characters (`keyHint`) are stored in plaintext for display
- The full key is only decrypted when making an API call, never returned to the client

---

## 6. Webhook Security

Each native workflow receives a unique webhook token on creation:

```typescript
webhookToken: crypto.randomBytes(16).toString('hex')
// → 32-character hex string, 128-bit entropy
```

- Tokens are stored as a **unique** field in the database
- `POST /api/v1/webhooks/:token` — no authentication required (by design)
- The controller checks `workflow.isActive === true` before executing
- The webhook token is the only authorization mechanism for external callers

---

## 7. MinIO Document Security

- The MinIO bucket is **private** (not publicly accessible)
- Download URLs are **presigned** via `@aws-sdk/s3-request-presigner` — time-limited
- Object paths include the `organizationId`: `org/{organizationId}/{uuid}_{filename}`
- The backend verifies the requesting user belongs to the org before generating download URLs
- Delete operations also verify org membership

---

## 8. SMTP Credential Protection

```typescript
// email.service.ts
const createTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Email] SMTP_USER or SMTP_PASS not set — emails will NOT be sent.');
    return null;  // credentials never logged
  }
  return nodemailer.createTransport({
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    // credentials only passed to nodemailer — never to console or logs
  });
};

// TEST_MODE guard — only skips delivery for test domains when explicitly enabled
if (process.env.TEST_MODE === 'true' && (to.endsWith('@example.com') || to.endsWith('@test.com'))) {
  console.log(`[Email] Skipping — test domain detected in TEST_MODE.`);
  return true;
}
// When TEST_MODE is false/undefined, normal SMTP behavior — no bypass
```

---

## 9. CORS Configuration

```typescript
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);  // curl, Postman, mobile
    const isLocalhost = /^http:\/\/localhost:\d+$/.test(origin);
    if (isLocalhost) return callback(null, true);  // dev: any localhost port
    // Production: CORS_ORIGINS or FRONTEND_URL env var
    const allowed = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '').split(',');
    if (allowed.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));
```

In production, set `CORS_ORIGINS=https://your-domain.com`.

---

## 10. HTTP Security Headers (Helmet.js)

Helmet.js automatically sets:
- `Content-Security-Policy`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`
- `X-XSS-Protection: 0` (deprecated but safe)
- `Referrer-Policy: no-referrer`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

---

## 11. Audit Logging

Every sensitive operation creates an `AuditLog` record:

| Resource | Actions Logged |
|---|---|
| Workflow | CREATE, AI_WORKFLOW_GENERATED, DELETE |
| Document | UPLOAD, DELETE |
| Organization | Member changes, setting changes |

Each record includes:
- `userId` — who performed the action
- `organizationId` — which org
- `oldData` — state before the action (for updates/deletes)
- `newData` — state after the action
- `createdAt` — immutable timestamp

Audit logs are **append-only** — no update or delete endpoints exist for them.

---

## 12. Production Security Checklist

Before deploying to production:

- [ ] Set `JWT_SECRET` to a 64+ character random string
- [ ] Set `JWT_REFRESH_SECRET` to a different 64+ character random string
- [ ] Set `ENCRYPTION_KEY` to a 32-character hex string (use `openssl rand -hex 16`)
- [ ] Set `NODE_ENV=production`
- [ ] Set `TEST_MODE=false`
- [ ] Enable HTTPS (TLS termination at reverse proxy)
- [ ] Set `CORS_ORIGINS` to your production domain only
- [ ] Use environment secrets manager (not plain `.env` file)
- [ ] Rotate JWT secrets periodically
- [ ] Enable PostgreSQL SSL
- [ ] Enable MinIO TLS or migrate to AWS S3 with IAM
- [ ] Configure rate limiting on all auth endpoints
- [ ] Set up log aggregation (Pino → ELK or Datadog)
- [ ] Regular database backups (`pg_dump`)
- [ ] Review and limit SMTP App Password scope
