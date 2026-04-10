import { Response, NextFunction } from 'express';

import { sendSuccess } from '../../../utils/response';
import { CustomerAuthRequest } from '../../../middlewares/customer-auth.middleware';
import * as ordersService from './orders.service';

export const getMyOrders = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const customerId = req.customer!.customerId;

    const orders = await ordersService.getMyOrders(customerId);

    sendSuccess(res, orders, 'Orders fetched successfully', 200);
  } catch (error) {
    next(error);
  }
};
