import { Router } from 'express';

import { requireAuth, requireRole } from '../../../middlewares/auth.middleware';
import * as creditController from './credit.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole('staff'));

router.get('/', creditController.listCredits);
router.put('/:customerId', creditController.upsertCreditLimit);

export default router;
