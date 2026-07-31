import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { aiService, ChatMessage } from '../services/ai.service';
import { requireOrgHeader, getParam } from '../utils/requestHelpers';
import { resolveOrgKey, touchLastUsed } from '../services/org-api-keys.service';

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
    const responseText = await aiService.chat(provider, chatHistory, {
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
      data: { conversationId: activeConversationId, role: 'assistant', content: responseText }
    });

    await prisma.conversation.update({
      where: { id: activeConversationId },
      data: { updatedAt: new Date() }
    });

    res.status(200).json({
      success: true,
      data: {
        response: responseText,
        conversationId: activeConversationId,
        messageId: savedMessage.id
      }
    });
  } catch (error: any) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// ─── GET /api/v1/ai/conversations ────────────────────────────────────────────
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
