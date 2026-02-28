import { Router } from 'express';

import { getHealth } from './health.controller';

// ─── Health Routes ────────────────────────────────────────────────────────────
// Mounted at: /api/health

const router = Router();

/**
 * @route   GET /api/health
 * @desc    API and database health check
 * @access  Public
 */
router.get('/', getHealth);

export default router;
