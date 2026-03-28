import { Request, Response, NextFunction } from 'express';

import { sendSuccess } from '../../../utils/response';
import * as customersService from './customers.service';

export const createCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, phone, email, password } = req.body;
    const customer = await customersService.createCustomer({ name, phone, email, password });
    sendSuccess(res, customer, 'Customer created successfully', 201);
  } catch (error) {
    next(error);
  }
};
