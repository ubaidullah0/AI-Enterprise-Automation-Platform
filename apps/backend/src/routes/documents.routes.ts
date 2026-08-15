import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadDocument, getDocuments, downloadDocument, deleteDocument } from '../controllers/documents.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);

router.post('/', upload.single('file'), uploadDocument);
router.get('/', getDocuments);
router.get('/:id/download', downloadDocument);
router.delete('/:id', deleteDocument);

export default router;
