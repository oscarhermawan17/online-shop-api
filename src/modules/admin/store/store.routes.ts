import { Router } from 'express';

import { requireAuth, requireRole } from '../../../middlewares/auth.middleware';
import * as storeController from './store.controller';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /admin/store - owner, manager only
router.get('/', requireRole('manager'), storeController.getStore);

// PATCH /admin/store - owner, manager only
router.patch('/', requireRole('manager'), storeController.updateStore);

export default router;
