# Troubleshooting Guide

This document lists common issues, errors, and resolutions for the AI Enterprise Automation Platform.

## 1. Environment and Configuration

### Prisma "Environment variable not found: DIRECT_URL"
- **Symptom:** Running `npx prisma validate` or `npm run start` fails with `Error code: P1012 error: Environment variable not found: DIRECT_URL`.
- **Cause:** The schema requires `DIRECT_URL` for production Supabase connection pooling.
- **Fix:** In `apps/backend/.env`, set `DIRECT_URL` to the same value as your `DATABASE_URL` for local development.

### JWT "secret must be a string" / App Crashing on Boot
- **Symptom:** Backend crashes immediately on startup.
- **Cause:** `JWT_SECRET` or `JWT_REFRESH_SECRET` is missing. The server is strictly configured to throw an error rather than fallback to a hardcoded insecure secret.
- **Fix:** Ensure both values are set in `apps/backend/.env`.

### MinIO "Missing credentials"
- **Symptom:** Backend crashes mentioning MinIO or S3.
- **Cause:** `MINIO_ROOT_USER` or `MINIO_ROOT_PASSWORD` is missing. The fallback defaults have been removed for security.
- **Fix:** Set the credentials in `.env` to match your Docker Compose MinIO configuration.

## 2. Docker & Infrastructure

### Port Conflicts
- **Symptom:** `docker compose up` fails with "bind: address already in use".
- **Cause:** Another service is using the port. Common offenders:
  - `5432/5433`: Local PostgreSQL installation.
  - `6379`: Local Redis installation.
  - `8080`: Local web server (Nginx/Apache).
- **Fix:** Stop the local service or change the exposed port on the left side of the `:` in `docker/docker-compose.yml` (e.g., `5434:5432`).

### PostgreSQL Connection Refused
- **Symptom:** Backend prints `PrismaClientInitializationError: Can't reach database server`.
- **Cause:** The PostgreSQL container hasn't finished booting, or the port mapping is wrong.
- **Fix:** Wait 10 seconds for the database to initialize and restart the backend. Verify the `DATABASE_URL` port matches the exposed Docker port (5433).

## 3. Application Issues

### AI Assistant Doesn't Respond
- **Symptom:** The chat bubble appears but stays blank or spins indefinitely.
- **Cause:** 
  1. API key is invalid or quota exceeded.
  2. Ollama is selected but not running locally.
- **Fix:** 
  - Check the backend console for `[AI Service] Chat failed: 401`.
  - For Ollama, run `ollama run llama3` in a separate terminal.
  - Ensure API keys are set in `Settings > API Keys`.

### "Module not found: is-ci" during Vercel Deployment
- **Symptom:** Vercel deployment fails during the `prepare` script.
- **Cause:** Husky attempts to install git hooks on the Vercel runner.
- **Fix:** This was resolved by adding `"prepare": "is-ci || husky install"` in the root `package.json`. If it recurs, ensure `is-ci` is in your `devDependencies`.

### Emails Not Sending
- **Symptom:** Password reset or welcome emails don't arrive.
- **Cause:** Gmail SMTP requires an "App Password", not your normal Google password.
- **Fix:** Generate a 16-character App Password from Google Account Security. Ensure `SMTP_USER` and `SMTP_PASS` are set.
