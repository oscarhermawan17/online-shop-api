import { Router } from 'express';

import { requireAuth, requireRole } from '../../../middlewares/auth.middleware';
import * as inventoryController from './inventory.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole('staff'));

router.get('/', inventoryController.listStockMovements);
router.get('/export', inventoryController.exportStockMovements);
router.post('/add', inventoryController.addStockAdjustment);

export default router;

