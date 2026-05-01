import { Router } from 'express';

import * as checkoutController from './checkout.controller';
import { optionalCustomerAuth } from '../../../middlewares/customer-auth.middleware';

const router = Router();

// ─── Public Checkout Routes ───────────────────────────────────────────────────

router.post('/checkout', optionalCustomerAuth, checkoutController.checkout);
router.post('/payment-proof', checkoutController.uploadPaymentProof);
router.get('/order/:publicOrderId', checkoutController.getOrderStatus);
router.patch('/order/:publicOrderId/complete', checkoutController.completeOrder);

export default router;
