import { Router } from 'express';

import { requireAuth, requireRole } from '../../../middlewares/auth.middleware';
import * as receivablesController from './receivables.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole('staff'));

router.get('/', receivablesController.listReceivables);
router.get('/export', receivablesController.exportReceivables);
router.post('/:id/payments', receivablesController.addPayment);

export default router;
