import { Router } from 'express';

import { requireAuth, requireRole } from '../../../middlewares/auth.middleware';
import * as dashboardController from './dashboard.controller';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Dashboard routes require at least staff role
router.use(requireRole('staff'));

// ─── Dashboard Routes ─────────────────────────────────────────────────────────
router.get('/', dashboardController.getDashboardData);

export default router;
