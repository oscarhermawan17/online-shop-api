import { Router } from 'express';

import { requireCustomerAuth } from '../../../middlewares/customer-auth.middleware';
import * as ordersController from './orders.controller';

const router = Router();

router.use(requireCustomerAuth);

// GET /customer/orders — get logged-in customer's orders
router.get('/', ordersController.getMyOrders);

export default router;
