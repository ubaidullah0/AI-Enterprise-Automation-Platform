import { Router } from 'express';
import { chatCompletion, getConversations, getMessages, deleteConversation } from '../controllers/ai.controller';
import { getAIUsage, checkAIRateLimit } from '../controllers/aiUsage.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();
router.use(requireAuth);

// Usage stats
router.get('/usage', getAIUsage);

// Chat — rate limited
router.post('/chat', checkAIRateLimit as any, chatCompletion);

// Conversations
router.get('/conversations', getConversations);
router.get('/conversations/:id/messages', getMessages);
router.delete('/conversations/:id', deleteConversation);

export default router;
