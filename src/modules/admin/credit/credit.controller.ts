import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { sendSuccess } from '../../../utils/response';
import * as creditService from './credit.service';

export const listCredits = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const credits = await creditService.listCredits(req.user!.storeId);
    sendSuccess(res, credits, 'Customer credits retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const upsertCreditLimit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { customerId } = req.params as { customerId: string };
    const creditLimit = Number(req.body.creditLimit);
    const termOfPayment = Number(req.body.termOfPayment ?? 0);

    const result = await creditService.upsertCreditLimit({
      storeId: req.user!.storeId,
      customerId,
      creditLimit,
      termOfPayment,
    });

    sendSuccess(res, result, 'Customer credit updated successfully');
  } catch (error) {
    next(error);
  }
};
