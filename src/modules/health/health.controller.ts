import { Request, Response, NextFunction } from 'express';

import { checkHealth } from './health.service';

// ─── Health Controller ────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Writes a HealthCheck record to the database and returns success status.
 */
export const getHealth = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await checkHealth();

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'API is healthy',
      data,
    });
  } catch (error) {
    next(error);
  }
};
