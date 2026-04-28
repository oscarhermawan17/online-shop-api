import { Router } from 'express';

import { requireCustomerAuth } from '../../../middlewares/customer-auth.middleware';
import * as ordersController from './orders.controller';

const router = Router();

router.use(requireCustomerAuth);

// GET /customer/orders — get logged-in customer's orders
router.get('/', ordersController.getMyOrders);
router.patch('/:id/complete', ordersController.completeMyOrder);
router.post('/:id/complaints', ordersController.createMyOrderComplaint);

export default router;
