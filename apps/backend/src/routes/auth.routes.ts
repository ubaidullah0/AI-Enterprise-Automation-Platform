import { Router } from 'express';
import { register, login, refresh, getMe, logout, setActiveOrganization } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Protected routes
router.get('/me', requireAuth, getMe);
router.put('/active-org', requireAuth, setActiveOrganization);

export default router;
