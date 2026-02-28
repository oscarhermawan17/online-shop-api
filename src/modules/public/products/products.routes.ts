import { Router } from 'express';

import * as productsController from './products.controller';

const router = Router();

// ─── Public Product Routes ────────────────────────────────────────────────────

router.get('/', productsController.listProducts);
router.get('/:id', productsController.getProduct);

export default router;
