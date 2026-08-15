import { Router } from 'express';
import { getAuditLogs, exportAuditLogsCSV } from '../controllers/audit.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();
router.use(requireAuth);

router.get('/export', exportAuditLogsCSV);
router.get('/', getAuditLogs);

export default router;
