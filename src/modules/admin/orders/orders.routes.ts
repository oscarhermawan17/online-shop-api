import { Router } from 'express';

import { requireAuth, requireRole } from '../../../middlewares/auth.middleware';
import * as ordersController from './orders.controller';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// All order management routes require at least staff role
router.use(requireRole('staff'));

// ─── Order Routes ─────────────────────────────────────────────────────────────

router.get('/', ordersController.listOrders);
router.get('/:id', ordersController.getOrder);
router.patch('/:id/confirm', ordersController.confirmPayment);
router.patch('/:id/status', ordersController.updateOrderStatus);

export default router;
