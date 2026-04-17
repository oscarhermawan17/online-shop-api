import { Response, NextFunction } from 'express';
import { CustomerType } from '@prisma/client';

import { AppError } from '../../../middlewares/error.middleware';
import { sendSuccess } from '../../../utils/response';
import * as customersService from './customers.service';
import { AuthRequest } from '../../../middlewares/auth.middleware';

export const getCustomers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const customers = await customersService.listCustomers(storeId);
    sendSuccess(res, customers, 'Customers retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createCustomer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { name, phone, email, password, type } = req.body;
    const customer = await customersService.createCustomer({
      storeId,
      name,
      phone,
      email,
      password,
      type,
    });
    sendSuccess(res, customer, 'Customer created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const toggleStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { id } = req.params as { id: string };
    const result = await customersService.toggleCustomerStatus(id, storeId);
    sendSuccess(res, result, 'Customer status updated successfully');
  } catch (error) {
    next(error);
  }
};

export const updateType = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { id } = req.params as { id: string };
    const { type } = req.body as { type?: CustomerType };

    if (type !== 'base' && type !== 'wholesale') {
      throw new AppError('Invalid customer type', 400);
    }

    const result = await customersService.updateCustomerType(id, storeId, type);
    sendSuccess(res, result, 'Customer type updated successfully');
  } catch (error) {
    next(error);
  }
};
