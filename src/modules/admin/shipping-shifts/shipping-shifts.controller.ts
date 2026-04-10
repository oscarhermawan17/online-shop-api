import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { sendSuccess } from '../../../utils/response';
import * as shippingShiftsService from './shipping-shifts.service';

export const getShippingShifts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const shifts = await shippingShiftsService.getShippingShifts(req.user!.storeId);
    sendSuccess(res, shifts, 'Shipping shifts fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const createShippingShift = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const shift = await shippingShiftsService.createShippingShift(
      req.user!.storeId,
      req.body,
    );
    sendSuccess(res, shift, 'Shipping shift created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateShippingShift = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const shift = await shippingShiftsService.updateShippingShift(
      req.user!.storeId,
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, shift, 'Shipping shift updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteShippingShift = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await shippingShiftsService.deleteShippingShift(
      req.user!.storeId,
      req.params.id as string,
    );
    sendSuccess(res, null, 'Shipping shift deleted successfully');
  } catch (error) {
    next(error);
  }
};
