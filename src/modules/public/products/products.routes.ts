import { Router } from 'express';

import { optionalCustomerAuth } from '../../../middlewares/customer-auth.middleware';
import * as productsController from './products.controller';

const router = Router();

// ─── Public Product Routes ────────────────────────────────────────────────────

router.get('/', optionalCustomerAuth, productsController.listProducts);
router.get('/:id', optionalCustomerAuth, productsController.getProduct);

export default router;
