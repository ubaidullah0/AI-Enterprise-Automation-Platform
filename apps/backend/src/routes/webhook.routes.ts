import { Router } from 'express';
import { handleWebhook } from '../controllers/webhook.controller';

const router = Router();

// Public endpoint, no auth middleware
router.post('/:token', handleWebhook);
router.get('/:token', handleWebhook); // Allow GET as well for some triggers

export default router;
