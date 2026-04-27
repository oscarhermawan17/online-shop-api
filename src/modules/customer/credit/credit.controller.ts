import { Response, NextFunction } from 'express';

import { sendSuccess } from '../../../utils/response';
import { CustomerAuthRequest } from '../../../middlewares/customer-auth.middleware';
import * as creditService from './credit.service';

export const getMyCreditOrders = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await creditService.getMyCreditOrders(
      req.customer!.storeId,
      req.customer!.customerId,
    );

    sendSuccess(res, result, 'Credit orders fetched successfully', 200);
  } catch (error) {
    next(error);
  }
};

export const getMyCreditSummary = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await creditService.getMyCreditSummary(
      req.customer!.storeId,
      req.customer!.customerId,
    );

    sendSuccess(res, result, 'Credit summary fetched successfully', 200);
  } catch (error) {
    next(error);
  }
};
