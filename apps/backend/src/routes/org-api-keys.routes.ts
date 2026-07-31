/**
 * org-api-keys.routes.ts
 *
 * All routes require:
 *   - requireAuth   → valid JWT
 *   - requireOrgRole(['OWNER', 'ADMIN']) → only org owners/admins can manage keys
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireOrgRole } from '../middleware/rbac.middleware';
import {
  listKeys,
  createKey,
  updateKey,
  deleteKey,
  validateKey,
  setDefault,
} from '../controllers/org-api-keys.controller';

const router = Router();

// All routes: authentication + OWNER/ADMIN only
router.use(requireAuth);
router.use(requireOrgRole(['OWNER', 'ADMIN']));

router.get('/', listKeys);
router.post('/', createKey);
router.put('/:id', updateKey);
router.delete('/:id', deleteKey);
router.post('/:id/validate', validateKey);
router.post('/:id/default', setDefault);

export default router;
