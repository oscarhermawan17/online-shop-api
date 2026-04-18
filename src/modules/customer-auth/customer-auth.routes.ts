import { Router } from 'express';

import { requireCustomerAuth } from '../../middlewares/customer-auth.middleware';
import * as customerAuthController from './customer-auth.controller';

const router = Router();

// POST /customer-auth/login
router.post('/login', customerAuthController.login);
router.post('/register', customerAuthController.register);
router.get('/me', requireCustomerAuth, customerAuthController.me);

export default router;
