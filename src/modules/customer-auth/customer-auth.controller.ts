import { Request, Response, NextFunction } from 'express';

import { CustomerAuthRequest } from '../../middlewares/customer-auth.middleware';
import { sendSuccess } from '../../utils/response';
import * as customerAuthService from './customer-auth.service';

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { storeId, identifier, password } = req.body;
    const result = await customerAuthService.login({ storeId, identifier, password });
    sendSuccess(res, result, 'Login successful', 200);
  } catch (error) {
    next(error);
  }
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { storeId, name, phone, email, password } = req.body;
    const result = await customerAuthService.register({
      storeId,
      name,
      phone,
      email,
      password,
    });
    sendSuccess(res, result, 'Customer registered successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const me = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await customerAuthService.getCurrentCustomer(
      req.customer!.customerId,
      req.customer!.storeId,
    );
    sendSuccess(res, result, 'Current customer fetched successfully', 200);
  } catch (error) {
    next(error);
  }
};
