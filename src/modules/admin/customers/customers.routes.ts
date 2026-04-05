import { Router } from 'express';

import { requireAuth, requireRole } from '../../../middlewares/auth.middleware';
import * as customersController from './customers.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole('staff'));

// GET /admin/customers — list all customers
router.get('/', customersController.getCustomers);

// POST /admin/customers — register a new customer
router.post('/', customersController.createCustomer);

// PATCH /admin/customers/:id/toggle-status — enable/disable customer
router.patch('/:id/toggle-status', customersController.toggleStatus);

export default router;
