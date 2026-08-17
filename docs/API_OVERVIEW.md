# API Overview

The AI Enterprise Automation Platform exposes a RESTful JSON API using Express 5.
Base URL: `/api/v1`

## Authentication (`/auth`)
- `POST /register`: Create a new user and automatically provision an organization.
- `POST /login`: Authenticate and receive `{ accessToken, refreshToken, user }`.
- `POST /refresh`: Exchange a valid refresh token for a new access token.
- `GET /me`: Get current authenticated user details.
- `PUT /active-org`: Switch the user's currently active organization context.
- `POST /forgot-password-otp`: Request a 6-digit OTP for password reset.
- `POST /verify-otp`: Validate the 6-digit OTP.
- `POST /reset-password-otp`: Set a new password using a verified OTP token.

## Organizations (`/orgs`)
- `POST /`: Create a new organization.
- `GET /:id`: Get organization details (requires membership).
- `POST /:id/invite`: Invite a new team member via email.
- `POST /accept-invite`: Accept an organization invitation token.
- `GET /:id/members`: List all members and their roles.

## AI Assistant (`/ai`)
- `GET /providers`: List available AI providers (OpenAI, Gemini, Ollama).
- `POST /chat/stream`: Stream an AI chat response using Server-Sent Events (SSE).
- `POST /chat`: Standard blocking AI chat request.
- `GET /conversations`: List user's conversation history.
- `GET /conversations/:id/messages`: Get messages for a specific conversation.
- `DELETE /conversations/:id`: Delete a conversation.

## Workflows (`/workflows`)
- `GET /`: List all workflows for the active organization.
- `POST /`: Create a new blank workflow.
- `GET /:id`: Get workflow configuration and canvas state.
- `PUT /:id`: Update workflow details.
- `PUT /:id/canvas`: Save the React Flow nodes and edges.
- `PUT /:id/toggle`: Activate/deactivate the workflow.
- `POST /:id/execute`: Manually trigger the native BFS workflow engine.
- `GET /:id/runs`: View execution history and payloads.
- `POST /generate`: Prompt an AI to generate a workflow JSON structure.

## Webhooks (`/webhooks`)
- `POST /:token`: Trigger a workflow externally using its secure token.

## Documents (`/documents`)
- `POST /`: Upload a file to MinIO (multipart/form-data).
- `GET /`: List all documents for the organization.
- `GET /:id`: Get document metadata.
- `GET /:id/download`: Generate a time-limited MinIO pre-signed URL.
- `DELETE /:id`: Delete document from DB and MinIO.

## Analytics (`/analytics`)
- `GET /overview`: High-level counts (workflows, messages, total cost).
- `GET /ai-usage`: Timeseries data for AI tokens and messages.
- `GET /providers`: Breakdown of conversations by AI provider.
- `GET /top-users`: List most active users in the organization.
- `GET /workflows`: Execution success rates for workflows.
- `GET /health`: Platform infrastructure health checks (PostgreSQL, Redis, etc.).

## Audit Logs (`/audit-logs`)
- `GET /`: Paginated list of system mutations.
- `GET /export`: Download audit logs as a CSV file.

## Organization API Keys (`/org-api-keys`)
*Requires OWNER or ADMIN role.*
- `GET /`: List configured AI providers (returns label/hints, never plaintext keys).
- `POST /`: Add a new AES-256-GCM encrypted API key.
- `POST /:id/validate`: Probe the provider to ensure the key is active.
- `POST /:id/default`: Set a key as the organization default for a provider.
- `DELETE /:id`: Remove a key.

## Background Jobs (`/jobs`)
- `GET /`: List queued, running, and failed jobs.
- `POST /:id/retry`: Manually re-queue a failed job.
- `POST /test`: Create a dummy job to verify the queue processor.
