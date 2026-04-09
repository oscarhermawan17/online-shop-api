import { Router } from 'express';

import { requireCustomerAuth } from '../../../middlewares/customer-auth.middleware';
import * as addressesController from './addresses.controller';

const router = Router();

router.use(requireCustomerAuth);

// GET /customer/addresses — get logged-in customer's addresses
router.get('/', addressesController.getMyAddresses);

// POST /customer/addresses — create a new address
router.post('/', addressesController.createAddress);

// PATCH /customer/addresses/:id — update an address
router.patch('/:id', addressesController.updateAddress);

// DELETE /customer/addresses/:id — delete an address
router.delete('/:id', addressesController.deleteAddress);

export default router;
