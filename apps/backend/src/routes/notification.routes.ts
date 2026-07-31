import { Router } from 'express';
import { getNotifications, markAllRead } from '../controllers/notification.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getNotifications);
router.put('/mark-read', markAllRead);

export default router;
