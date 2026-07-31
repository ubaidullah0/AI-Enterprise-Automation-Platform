import { Router } from 'express';
import { 
  listWorkflows, 
  createWorkflow, 
  deleteWorkflow 
} from '../controllers/workflow.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Protect all workflow routes
router.use(requireAuth);

router.get('/', listWorkflows);
router.post('/', createWorkflow);
router.delete('/:id', deleteWorkflow);

export default router;
