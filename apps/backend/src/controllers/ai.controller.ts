import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { aiService, ChatMessage } from '../services/ai.service';
import { requireOrgHeader, getParam } from '../utils/requestHelpers';
import { resolveOrgKey, touchLastUsed } from '../services/org-api-keys.service';

// ─── GET /api/v1/ai/providers ───────────────────────────────────────────────────
export const getProviders = async (req: Request, res: Response) => {
  try {
    const providers = [];

    let organizationId: string | null = null;
    try { 
      organizationId = requireOrgHeader(req); 
    } catch (e) {
      // It's possible to call this without an org header in some contexts, but we prefer it.
    }

    const hasOrgOpenAI = organizationId ? await resolveOrgKey(organizationId, 'openai') !== null : false;
    const hasOrgGemini = organizationId ? await resolveOrgKey(organizationId, 'gemini') !== null : false;

    // Check OpenAI — use env var or hardcoded fallback key
    const openaiKey = process.env.OPENAI_API_KEY || 'sk-proj-_K8VnQy2JxxaQzSkkOxs4Go2OHy-XozM8Zuqa_kH8FDRa_tSOgxiovB5Xbwo624gjnnuQ2-HG1T3BlbkFJl7lX1DWMgJkk1Yb6XfafxZWmcQgqDiYcJKc38MQOnNu1ddGYiEABS7qddrKTSsyq8fWrxr0ProA';
    if (openaiKey || hasOrgOpenAI) {
      providers.push({ id: 'openai', name: 'GPT-4o', color: 'from-emerald-500 to-teal-400' });
    }

    // Check Gemini — use env var or hardcoded fallback key
    const geminiKey = process.env.GEMINI_API_KEY || 'AIzaSyAb8RN6KE9zOsquGlmXtYSLgd29DapIhc3iabQ53uKGGOqGh7bw';
    if (geminiKey || hasOrgGemini) {
      providers.push({ id: 'gemini', name: 'Gemini 2.0 Flash', color: 'from-blue-500 to-cyan-400' });
    }

    // Check Ollama (with strict 300ms timeout so it never blocks or causes loading delay)
    try {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300);
      const ollamaRes = await fetch(`${ollamaUrl}/api/tags`, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);
      if (ollamaRes.ok) {
        providers.push({ id: 'ollama', name: 'Ollama (Local Models)', color: 'from-purple-500 to-indigo-400' });
      }
    } catch (e) {
      // Ollama not running or unreachable, skip immediately without waiting
    }

    // Always fallback to OpenAI if somehow everything fails, to match frontend expectations,
    // but dynamically we only return what's available.
    res.status(200).json({ success: true, data: providers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── POST /api/v1/ai/chat ─────────────────────────────────────────────────────
export const chatCompletion = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    const { prompt, provider = 'openai', model, conversationId } = req.body as {
      prompt?: string;
      provider?: string;
      model?: string;
      conversationId?: string;
    };

    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt is required' });
    }

    // ── Get or create conversation ────────────────────────────────────────────
    let activeConversationId = conversationId;

    if (!activeConversationId) {
      const title = prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt;
      const conversation = await prisma.conversation.create({
        data: { organizationId, userId, title, provider }
      });
      activeConversationId = conversation.id;
    }

    // ── Build message history for multi-turn context ──────────────────────────
    const previousMessages = await prisma.message.findMany({
      where: { conversationId: activeConversationId },
      orderBy: { createdAt: 'asc' },
      take: 20
    });

    const chatHistory: ChatMessage[] = previousMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));

    chatHistory.push({ role: 'user', content: prompt });

    // ── Save user message ─────────────────────────────────────────────────────
    await prisma.message.create({
      data: { conversationId: activeConversationId, role: 'user', content: prompt }
    });

    // ── Resolve org-level API key (Org key → .env fallback) ──────────────────
    const orgApiKey = await resolveOrgKey(organizationId, provider);

    // ── Generate AI response ──────────────────────────────────────────────────
    const { response: responseText, tokensUsed, costUsd, latencyMs } = await aiService.chatWithUsage(provider, chatHistory, {
      systemPrompt: 'You are an expert enterprise AI assistant. Help users manage workflows, automations, and business processes. Be professional, concise, and helpful. Format code in markdown code blocks.',
      model,
      apiKey: orgApiKey ?? undefined, // undefined → provider falls back to process.env
    });

    // ── Update org key lastUsedAt (non-blocking, non-fatal) ───────────────────
    if (orgApiKey) {
      touchLastUsed(organizationId, provider).catch(() => {});
    }

    // ── Save assistant response ───────────────────────────────────────────────
    const savedMessage = await prisma.message.create({
      data: {
        conversationId: activeConversationId,
        role: 'assistant',
        content: responseText,
        tokens: tokensUsed,
        costUsd,
        latencyMs
      }
    });

    await prisma.conversation.update({
      where: { id: activeConversationId },
      data: { updatedAt: new Date() }
    });

    res.status(200).json({
      success: true,
      data: {
        conversationId: activeConversationId,
        messageId: savedMessage.id,
        response: responseText
      }
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden')) return res.status(403).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Internal server error', details: error.message });
  }
};

// ─── POST /api/v1/ai/chat/stream ──────────────────────────────────────────────
export const chatStream = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    const { prompt, provider = 'openai', model, conversationId } = req.body as {
      prompt?: string;
      provider?: string;
      model?: string;
      conversationId?: string;
    };

    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt is required' });
    }

    // Initialize SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let activeConversationId = conversationId;
    if (!activeConversationId) {
      const title = prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt;
      const conversation = await prisma.conversation.create({
        data: { organizationId, userId, title, provider }
      });
      activeConversationId = conversation.id;
    }

    const previousMessages = await prisma.message.findMany({
      where: { conversationId: activeConversationId },
      orderBy: { createdAt: 'asc' },
      take: 20
    });

    const chatHistory: ChatMessage[] = previousMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));
    chatHistory.push({ role: 'user', content: prompt });

    await prisma.message.create({
      data: { conversationId: activeConversationId, role: 'user', content: prompt }
    });

    const orgApiKey = await resolveOrgKey(organizationId, provider);
    if (orgApiKey) {
      touchLastUsed(organizationId, provider).catch(() => {});
    }

    let fullResponse = '';
    const start = Date.now();

    // Stream directly to the client
    await aiService.streamChat(provider, chatHistory, (token) => {
      fullResponse += token;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }, {
      systemPrompt: 'You are an expert enterprise AI assistant. Help users manage workflows, automations, and business processes. Be professional, concise, and helpful. Format code in markdown code blocks.',
      model,
      apiKey: orgApiKey ?? undefined,
    });

    const latencyMs = Date.now() - start;

    // Save final message after stream completes
    const savedMessage = await prisma.message.create({
      data: {
        conversationId: activeConversationId,
        role: 'assistant',
        content: fullResponse,
        tokens: null,
        costUsd: null,
        latencyMs
      }
    });

    await prisma.conversation.update({
      where: { id: activeConversationId },
      data: { updatedAt: new Date() }
    });

    res.write(`data: ${JSON.stringify({ done: true, conversationId: activeConversationId, messageId: savedMessage.id })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Chat stream error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Streaming failed' })}\n\n`);
    res.end();
  }
};

// ─── GET /api/v1/ai/conversations ─────────────────────────────────────────────
export const getConversations = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    const conversations = await prisma.conversation.findMany({
      where: { organizationId, userId },
      orderBy: { updatedAt: 'desc' },
      take: 50
    });

    res.status(200).json({ success: true, data: conversations });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── GET /api/v1/ai/conversations/:id/messages ───────────────────────────────
export const getMessages = async (req: Request, res: Response) => {
  try {
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    const id = getParam(req, 'id');

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation || conversation.organizationId !== organizationId) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' }
    });

    res.status(200).json({ success: true, data: messages });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── DELETE /api/v1/ai/conversations/:id ─────────────────────────────────────
export const deleteConversation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId as string;
    let organizationId: string;
    try { organizationId = requireOrgHeader(req); }
    catch (e: any) { return res.status(e.status || 400).json({ success: false, message: e.message }); }

    const id = getParam(req, 'id');

    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation || conversation.organizationId !== organizationId || conversation.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    await prisma.message.deleteMany({ where: { conversationId: id } });
    await prisma.conversation.delete({ where: { id } });

    res.status(200).json({ success: true, message: 'Conversation deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
