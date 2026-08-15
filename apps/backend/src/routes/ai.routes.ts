import { Router } from 'express';
import { chatCompletion, chatStream, getConversations, getMessages, deleteConversation, getProviders } from '../controllers/ai.controller';
import { getAIUsage, checkAIRateLimit } from '../controllers/aiUsage.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();
router.use(requireAuth);

// Providers
router.get('/providers', getProviders);

// Usage stats
router.get('/usage', getAIUsage);

// Chat — rate limited
router.post('/chat', checkAIRateLimit as any, chatCompletion);
router.post('/chat/stream', checkAIRateLimit as any, chatStream);

// Conversations
router.get('/conversations', getConversations);
router.get('/conversations/:id/messages', getMessages);
router.delete('/conversations/:id', deleteConversation);

export default router;
