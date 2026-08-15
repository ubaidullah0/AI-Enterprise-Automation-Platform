# Storage & Documents — AI Enterprise Automation Platform

---

## 1. MinIO Overview

MinIO is an open-source, S3-compatible object storage server. The platform deploys it via Docker Compose for local development. MinIO is used as the backend for all file storage — documents uploaded by users are stored as objects in MinIO, not in PostgreSQL.

**Why MinIO?**
- S3-compatible API allows migration to AWS S3 or any other S3-compatible service in production
- Self-hosted — data stays within your infrastructure
- Supports presigned URLs for secure, time-limited downloads
- High performance for binary data

---

## 2. Bucket Configuration

The platform stores all files in a single configurable bucket:

```env
MINIO_BUCKET=documents
```

The bucket must be created before uploading (see `docs/WINDOWS_SETUP.md`). In development, the bucket is created manually via the MinIO Console at http://localhost:9001. The platform does **not** auto-create the bucket on startup (to avoid overwriting existing configurations).

---

## 3. Object Path Structure

All objects are stored with organization-scoped paths to ensure data isolation:

```
org/{organizationId}/{uuid}_{originalFilename}
```

Example:
```
org/2d31f4db-f88e-4a52-ba4a-dfd9a3e5987b/550e8400-e29b-41d4-a716-446655440000_report.pdf
```

The `uuid` prefix ensures uniqueness even if multiple files with the same name are uploaded.

---

## 4. Upload Flow

```
1. User selects file in DocumentManager UI
2. Frontend sends: POST /api/v1/documents (multipart/form-data)
3. requireAuth middleware verifies JWT
4. X-Organization-ID header verified (checkOrgAccess)
5. Multer processes multipart upload into memory buffer
6. StorageService.upload():
   → S3 PutObjectCommand {
       Bucket: MINIO_BUCKET,
       Key: 'org/{organizationId}/{uuid}_{filename}',
       Body: buffer,
       ContentType: mimeType
     }
7. Prisma Document.create {
     organizationId,
     uploadedBy: userId,
     fileName: originalFilename,
     fileUrl: 'org/{organizationId}/{uuid}_{filename}',  (the MinIO object key)
     mimeType,
     size: buffer.length
   }
8. AuditLog.create { action: 'UPLOAD', newData: { fileName, size } }
9. Return { success: true, data: documentRecord }
```

---

## 5. Download Flow

```
1. User clicks Download in DocumentManager UI
2. GET /api/v1/documents/:id/download
3. JWT + org membership verified
4. Prisma Document.findUnique { where: { id, organizationId } }
5. StorageService.getPresignedUrl(document.fileUrl):
   → S3 GetObjectCommand
   → getSignedUrl(client, command, { expiresIn: 3600 })  // 1-hour expiry
6. Return { downloadUrl: presignedUrl }
7. Frontend opens presignedUrl in new tab (direct from MinIO)
```

Presigned URLs expire after 1 hour. After expiry, the user must request a fresh download link.

---

## 6. Delete Flow

```
1. User clicks Delete in DocumentManager UI
2. DELETE /api/v1/documents/:id
3. JWT + org membership verified
4. Prisma Document.findUnique { where: { id, organizationId } }
5. StorageService.delete(document.fileUrl):
   → S3 DeleteObjectCommand { Bucket, Key: document.fileUrl }
6. Prisma Document.delete { where: { id } }
7. AuditLog.create { action: 'DELETE', oldData: { fileName, size } }
8. Return { success: true, message: 'Document deleted' }
```

---

## 7. PostgreSQL Document Model

```prisma
model Document {
  id             String  @id @default(uuid())
  organizationId String
  uploadedBy     String   // userId
  fileName       String   // original filename
  fileUrl        String   // MinIO object key (not a public URL)
  mimeType       String?
  size           Int?     // bytes

  organization Organization @relation(...)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

The `fileUrl` field stores the MinIO object **key** (path), not a public URL. Actual download URLs are generated on-demand as presigned URLs.

---

## 8. Security

| Layer | Mechanism |
|---|---|
| Authentication | `requireAuth` JWT middleware |
| Authorization | `checkOrgAccess` verifies org membership |
| Data isolation | `organizationId` in all Prisma queries |
| File isolation | Object path includes `organizationId` |
| Download access | Presigned URLs — time-limited (1 hour) |
| Bucket privacy | MinIO bucket is NOT publicly accessible |
| Audit | Every upload and delete is logged in `AuditLog` |

---

## 9. AuditLog Integration

Two audit events are created automatically:

**Upload:**
```json
{
  "resource": "Document",
  "action": "UPLOAD",
  "newData": {
    "fileName": "report.pdf",
    "size": 204800,
    "mimeType": "application/pdf"
  }
}
```

**Delete:**
```json
{
  "resource": "Document",
  "action": "DELETE",
  "oldData": {
    "fileName": "report.pdf",
    "size": 204800
  }
}
```

These records are visible in the Audit & Compliance dashboard (OWNER/ADMIN only).

---

## 10. Configuration

| Variable | Description | Example |
|---|---|---|
| `MINIO_ENDPOINT` | MinIO host (without protocol) | `localhost` |
| `MINIO_ACCESS_KEY` | MinIO access key (root user) | `admin` |
| `MINIO_SECRET_KEY` | MinIO secret key (root password) | `password123` |
| `MINIO_BUCKET` | Bucket name for documents | `documents` |
| `MINIO_ROOT_USER` | Docker Compose env var | `admin` |
| `MINIO_ROOT_PASSWORD` | Docker Compose env var | `password123` |

The AWS SDK S3 client is configured to point to MinIO:
```typescript
const s3 = new S3Client({
  region: 'us-east-1',  // required but ignored by MinIO
  endpoint: `http://${MINIO_ENDPOINT}:9000`,
  forcePathStyle: true,  // required for MinIO
  credentials: { accessKeyId: MINIO_ACCESS_KEY, secretAccessKey: MINIO_SECRET_KEY }
});
```
