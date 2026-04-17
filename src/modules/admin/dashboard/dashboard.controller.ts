import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { sendSuccess } from '../../../utils/response';
import * as dashboardService from './dashboard.service';

// ─── GET /admin/dashboard ─────────────────────────────────────────────────────

export const getDashboardData = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { period, startDate, endDate } = req.query;
    const data = await dashboardService.getDashboardData(
      req.user!.storeId,
      period as string,
      startDate as string,
      endDate as string,
    );
    sendSuccess(res, data, 'Dashboard data fetched successfully');
  } catch (error) {
    next(error);
  }
};
