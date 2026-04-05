import { Response, NextFunction } from 'express';

import { sendSuccess } from '../../../utils/response';
import * as customersService from './customers.service';
import { AuthRequest } from '../../../middlewares/auth.middleware';

export const createCustomer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { name, phone, email, password } = req.body;
    const customer = await customersService.createCustomer({ storeId, name, phone, email, password });
    sendSuccess(res, customer, 'Customer created successfully', 201);
  } catch (error) {
    next(error);
  }
};
