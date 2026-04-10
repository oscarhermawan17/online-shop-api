import { Router } from 'express';

import { requireAuth, requireRole } from '../../../middlewares/auth.middleware';
import * as controller from './shipping-shifts.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole('manager'));

router.get('/', controller.getShippingShifts);
router.post('/', controller.createShippingShift);
router.patch('/:id', controller.updateShippingShift);
router.delete('/:id', controller.deleteShippingShift);

export default router;
