# AI Enterprise Automation Platform — Product Guide

## What is this platform?
The AI Enterprise Automation Platform is a centralized workspace that brings together conversational AI and visual workflow automation. It is designed for multi-tenant organizations to securely manage AI interactions, build complex data workflows without code, and monitor automation analytics—all from a single, unified interface.

## Main Features

### 1. Multi-Tenant Organizations & RBAC
- Every user belongs to one or more **Organizations**.
- Data is strictly isolated. Workflows, documents, and chat history belong to the organization, not the individual user.
- **Roles:**
  - `OWNER`: Full control, billing, API key management.
  - `ADMIN`: Manage workflows, team members, and settings.
  - `MANAGER`: Create workflows and use AI features.
  - `MEMBER`: View-only access and basic AI chat.

### 2. Conversational AI Assistant
A built-in AI chat interface that streams responses in real-time.
- **Multiple Providers:** Switch seamlessly between OpenAI GPT-4o, Google Gemini 2.0 Flash, and self-hosted Ollama.
- **Contextual Memory:** All conversations are persisted to the database.

### 3. Visual Workflow Automation (Dual Engine)
- **Native Engine:** Use the drag-and-drop canvas to build fast, lightweight workflows (e.g., HTTP requests, conditional logic, AI actions).
- **n8n Engine:** Connect to the embedded n8n instance to tap into hundreds of third-party enterprise integrations (Salesforce, Slack, Google Workspace).

### 4. AI Workflow Generation
Describe what you want to automate in plain English (e.g., "When a webhook is received, summarize the payload with AI and send it as an email"). The AI will instantly generate the visual workflow graph on the canvas.

### 5. Document Management
Securely upload, store, and download files. Powered by MinIO (S3-compatible storage) under the hood, ensuring documents remain within your infrastructure.

### 6. Platform Analytics & Audit
- **Analytics:** View token consumption, estimated USD costs, workflow execution success rates, and top users.
- **Audit Logging:** Every configuration change, workflow creation, or security event is immutably logged and exportable as CSV for compliance.

### 7. Background Jobs & Notifications
- Long-running tasks are handled by a robust, PostgreSQL-backed background job queue.
- Users receive real-time notifications via the in-app notification bell for both personal events and organization-wide broadcasts.
