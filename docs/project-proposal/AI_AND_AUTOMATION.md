# AI & Automation — AI Enterprise Automation Platform

---

## 1. AI Provider Abstraction

The platform supports three AI providers through a unified abstract interface:

```typescript
abstract class AIProvider {
  abstract generateText(prompt: string, options?: AICompletionOptions): Promise<string>
  abstract generateChatResponse(messages: ChatMessage[], options?: AICompletionOptions): Promise<string>
  abstract generateChatResponseWithUsage(messages, options?): Promise<{
    response: string
    tokensUsed: number | null
    latencyMs: number
  }>
  abstract streamChatResponse(messages, onToken: (token: string) => void, options?): Promise<void>
}
```

The `AIService` facade selects the correct provider at runtime:

```typescript
class AIService {
  getProvider(name: string, apiKey?: string): AIProvider
  chat(provider, messages, options) → Promise<string>
  chatWithUsage(provider, messages) → Promise<{response, tokensUsed, costUsd, latencyMs}>
  streamChat(provider, messages, onToken) → Promise<void>
}
```

---

## 2. OpenAI Integration

**Provider:** `OpenAIProvider`  
**SDK:** `openai` v7  
**Default Model:** `gpt-4o`  
**API Key:** `OPENAI_API_KEY` environment variable

Features:
- Chat completions with system prompt injection
- Token usage tracked via `response.usage.total_tokens`
- SSE streaming via the OpenAI streaming API
- Cost estimation via `estimateCost()` in `analytics.service.ts`

```typescript
const response = await this.openai.chat.completions.create({
  model: options?.model || 'gpt-4o',
  messages: [systemMsg, ...chatMessages],
  temperature: 0.7,
  max_tokens: options?.maxTokens,
});
const tokensUsed = response.usage?.total_tokens;
```

---

## 3. Ollama Integration (Local LLM)

**Provider:** `OllamaProvider`  
**API:** HTTP REST to `OLLAMA_BASE_URL` (default: `http://localhost:11434`)  
**No API key required**

Features:
- Supports any model available in the local Ollama installation
- HTTP POST to `/api/chat` with streaming support
- No cost (fully local)
- Returns `null` for token usage (Ollama does not expose this consistently)

---

## 4. Gemini Integration

**Provider:** `GeminiProvider`  
**SDK:** `@google/generative-ai` v0.24  
**Default Model:** `gemini-2.0-flash`  
**API Key:** `GEMINI_API_KEY` environment variable

Features:
- Uses `startChat` with conversation history
- Token usage via `result.response.usageMetadata.totalTokenCount`
- SSE streaming via `sendMessageStream`
- System instruction support

```typescript
const model = this.genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  systemInstruction: systemPrompt
});
const chat = model.startChat({ history, generationConfig: { temperature: 0.7 } });
const result = await chat.sendMessage(lastMessage.content);
```

---

## 5. AI Assistant

The AI Assistant provides a conversational interface with persistent history:

### Endpoints
- `GET /api/v1/ai/providers` — list configured/available providers with models
- `POST /api/v1/ai/chat` — non-streaming chat (returns complete response)
- `POST /api/v1/ai/chat/stream` — SSE streaming (progressive token delivery)
- `GET /api/v1/ai/conversations` — conversation history with messages

### Conversation Persistence
Each conversation is stored in the `Conversation` model with all messages, token counts, cost estimates, and response latency.

### Provider Selection
The frontend shows only providers that are configured (have valid API keys or are reachable locally).

---

## 6. Token Tracking and Cost Estimation

Each `Message` record stores:
- `tokens` — total tokens used (prompt + completion)
- `costUsd` — estimated cost (float, nullable)
- `latencyMs` — AI response time in milliseconds

Cost estimation (`estimateCost` in `analytics.service.ts`) maps provider + model to approximate USD/1K token rates. This is an **estimate** only and may not reflect actual billing.

---

## 7. AI Workflow Generation

The AI workflow generation feature converts natural language to executable workflow definitions:

### Flow
```
User enters prompt
  ↓
POST /api/v1/workflows/generate { prompt, provider? }
  ↓
AIWorkflowGenerator.generateWorkflowFromJson(prompt, provider)
  ↓
AI called with structured system prompt:
  "Return ONLY valid JSON matching this schema: {name, description, 
   aiExplanation, nodes: [{id, type, data, position}], edges: [{id, source, target}]}"
  ↓
JSON.parse() + validation
  ↓
Return { nodes, edges, name, description, aiExplanation, aiGenerated: true, aiPrompt, aiProvider }
  ↓
Frontend displays Preview screen
  ↓
User clicks "Approve & Build"
  ↓
POST /api/v1/workflows { ...data, aiGenerated: true }
  ↓
AuditLog { action: 'AI_WORKFLOW_GENERATED' }
  ↓
Redirect to WorkflowBuilder
```

### Validation
- Response must be valid JSON (JSON.parse throws on failure)
- Must contain `nodes` array and `edges` array
- Each node must have `id`, `type`, `data`, `position`
- Each edge must have `id`, `source`, `target`

---

## 8. Native Workflow Engine

### Supported Node Types

| Node Type | Description | Key Fields |
|---|---|---|
| `trigger_webhook` | Webhook HTTP entry point | — |
| `trigger_manual` | Manual/test execution entry | — |
| `action_email` | Send or simulate email | `to`, `subject`, `body` |
| `action_http` | HTTP request to external URL | `url`, `method`, `headers`, `body` |
| `action_ai` | AI prompt execution | `prompt`, `provider`, `model`, `systemPrompt` |
| `action_log` | Log output to context | `message` |
| `logic_condition` | Branch on condition | `value1`, `operator`, `value2` |

### Template Variables
Node data fields support `{{variable}}` syntax:
- `{{trigger.body.email}}` — access trigger payload fields
- `{{nodeId.response}}` — access a previous node's output

### Execution Context
The `context` object accumulates results as nodes execute:
```json
{
  "trigger": { "body": {}, "query": {}, "headers": {} },
  "node-1": { "success": true, "to": "...", "subject": "..." },
  "node-2": { "response": "AI generated text..." }
}
```

### WorkflowRun States
```
PENDING  →  RUNNING  →  COMPLETED
                     ↘  FAILED
```

---

## 9. n8n Integration

n8n is a separate external service for complex workflow automation beyond what the native engine handles.

### Architecture
```
Platform Backend ──── POST /api/v1/workflows (engine: 'n8n')
                           ↓
                    N8nService.createWorkflow(name)
                           ↓
                    n8n REST API (port 5680)
                    POST /api/v1/workflows
                    X-N8N-API-KEY: <from env>
                           ↓
                    Returns { id: n8nWorkflowId }
                           ↓
                    Stored in Workflow.n8nWorkflowId
```

### "Open in n8n" Feature
When a user clicks "Open in n8n" on an n8n-type workflow, the link navigates to:
```
${N8N_URL}/workflow/${n8nWorkflowId}
```
This opens the n8n visual editor for the created workflow.

### API Key Security
The `N8N_API_KEY` is injected via Axios request interceptor at call time (not at module load), ensuring `.env` changes are picked up without restart.

---

## 10. Webhook Triggers

Native workflows can be triggered externally via a unique webhook URL:

```
Webhook URL: POST http://localhost:4000/api/v1/webhooks/{webhookToken}
```

### Requirements
1. The workflow must be a native workflow (not n8n)
2. `workflow.isActive` must be `true`
3. The webhook token must match exactly

### Payload Injection
The POST body, query parameters, and headers are available in the workflow context:
```json
{
  "trigger": {
    "body": { /* POST body */ },
    "query": { /* URL query params */ },
    "headers": { /* HTTP headers */ }
  }
}
```

### Response
The webhook endpoint returns `202 Accepted` immediately. Workflow execution is asynchronous.

---

## 11. AI Rate Limiting

Current implementation:
- OTP endpoint: max 3 requests per 15 minutes (enforced in controller)
- No global AI endpoint rate limiting in development

Production recommendation:
- Add express-rate-limit on `/api/v1/ai/chat` and `/api/v1/ai/chat/stream`
- Track usage per user/org to enforce token quotas
- Alert on unusual consumption patterns via the analytics dashboard
