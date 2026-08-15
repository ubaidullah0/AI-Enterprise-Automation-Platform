import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  getOverview,
  getAIUsage,
  getWorkflowStats,
  getTopUsers,
  getProviderBreakdown,
  exportAuditCsv,
  getPlatformHealth
} from '../controllers/analytics.controller';

const router = Router();

// All analytics endpoints require authentication
router.use(requireAuth);

router.get('/overview', getOverview);
router.get('/health', getPlatformHealth);
router.get('/ai-usage', getAIUsage);
router.get('/workflow-stats', getWorkflowStats);
router.get('/top-users', getTopUsers);
router.get('/provider-breakdown', getProviderBreakdown);
router.get('/export.csv', exportAuditCsv);

export default router;
