import { Router } from 'express';
import { getJobs, retryJob, createTestJob } from '../controllers/jobs.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', getJobs);
router.post('/:id/retry', retryJob);
router.post('/test', createTestJob);

export default router;
