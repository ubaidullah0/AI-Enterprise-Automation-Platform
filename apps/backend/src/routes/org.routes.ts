import { Router } from 'express';
import { 
  createOrganization, 
  getOrganization, 
  inviteMember, 
  changeRole, 
  removeMember 
} from '../controllers/org.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Protect all org routes
router.use(requireAuth);

router.post('/', createOrganization);
router.get('/:id', getOrganization);
router.post('/:id/invite', inviteMember);
router.put('/:id/members/:userId/role', changeRole);
router.delete('/:id/members/:userId', removeMember);

export default router;
