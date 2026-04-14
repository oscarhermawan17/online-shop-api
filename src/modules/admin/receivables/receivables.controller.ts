import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { sendSuccess } from '../../../utils/response';
import * as receivablesService from './receivables.service';

export const listReceivables = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await receivablesService.listReceivables(req.user!.storeId);
    sendSuccess(res, result, 'Receivables fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const addPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await receivablesService.addReceivablePayment({
      orderId: req.params.id as string,
      storeId: req.user!.storeId,
      amount: Number(req.body.amount),
      receivedAt: String(req.body.receivedAt),
    });

    sendSuccess(res, result, 'Receivable payment saved successfully', 201);
  } catch (error) {
    next(error);
  }
};
