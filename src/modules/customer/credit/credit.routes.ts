import { Router } from 'express';

import { requireCustomerAuth } from '../../../middlewares/customer-auth.middleware';
import * as creditController from './credit.controller';

const router = Router();

router.use(requireCustomerAuth);

router.get('/', creditController.getMyCreditSummary);

export default router;
