import { Router } from 'express';

import { requireAuth, requireRole } from '../../../middlewares/auth.middleware';
import * as controller from './shipping-drivers.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole('manager'));

router.get('/', controller.getShippingDrivers);
router.post('/', controller.createShippingDriver);
router.patch('/:id', controller.updateShippingDriver);
router.delete('/:id', controller.deleteShippingDriver);

export default router;
