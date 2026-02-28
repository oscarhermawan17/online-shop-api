import { Router } from 'express';

import * as checkoutController from './checkout.controller';

const router = Router();

// ─── Public Checkout Routes ───────────────────────────────────────────────────

router.post('/checkout', checkoutController.checkout);
router.post('/payment-proof', checkoutController.uploadPaymentProof);
router.get('/order/:publicOrderId', checkoutController.getOrderStatus);

export default router;
