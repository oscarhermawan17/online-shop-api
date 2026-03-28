import { Router } from 'express';

import { requireAuth, requireRole } from '../../../middlewares/auth.middleware';
import * as customersController from './customers.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole('staff'));

// POST /admin/customers — register a new customer
router.post('/', customersController.createCustomer);

export default router;
