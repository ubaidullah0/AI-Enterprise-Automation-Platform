import { Router } from 'express';
import { 
  listWorkflows, 
  createWorkflow, 
  deleteWorkflow,
  updateCanvas,
  executeNativeWorkflow,
  generateWorkflow
} from '../controllers/workflow.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Protect all workflow routes
router.use(requireAuth);

router.get('/', listWorkflows);
router.post('/', createWorkflow);
router.post('/generate', generateWorkflow);
router.delete('/:id', deleteWorkflow);
router.put('/:id/canvas', updateCanvas);
router.post('/:id/execute', executeNativeWorkflow);

export default router;
