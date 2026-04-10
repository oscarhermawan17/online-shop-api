import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { sendSuccess } from '../../../utils/response';
import * as shippingDriversService from './shipping-drivers.service';

export const getShippingDrivers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const drivers = await shippingDriversService.getShippingDrivers(
      req.user!.storeId,
    );
    sendSuccess(res, drivers, 'Shipping drivers fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const createShippingDriver = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await shippingDriversService.createShippingDriver(
      req.user!.storeId,
      req.body,
    );
    sendSuccess(res, driver, 'Shipping driver created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateShippingDriver = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await shippingDriversService.updateShippingDriver(
      req.user!.storeId,
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, driver, 'Shipping driver updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteShippingDriver = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await shippingDriversService.deleteShippingDriver(
      req.user!.storeId,
      req.params.id as string,
    );
    sendSuccess(res, null, 'Shipping driver deleted successfully');
  } catch (error) {
    next(error);
  }
};
