import { Router } from 'express';

import * as customerAuthController from './customer-auth.controller';

const router = Router();

// POST /customer-auth/login
router.post('/login', customerAuthController.login);

export default router;
