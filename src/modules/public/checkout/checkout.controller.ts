import { Request, Response, NextFunction } from 'express';

import { sendSuccess } from '../../../utils/response';
import * as checkoutService from './checkout.service';

// ─── POST /checkout ───────────────────────────────────────────────────────────

export const checkout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await checkoutService.checkout(req.body);
    sendSuccess(res, result, 'Order created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// ─── POST /payment-proof ──────────────────────────────────────────────────────

export const uploadPaymentProof = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { publicOrderId, imageUrl } = req.body;
    const result = await checkoutService.uploadPaymentProof(publicOrderId, {
      imageUrl,
    });
    sendSuccess(res, result, 'Payment proof uploaded successfully');
  } catch (error) {
    next(error);
  }
};

// ─── GET /order/:publicOrderId ────────────────────────────────────────────────

export const getOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await checkoutService.getOrderStatus(req.params.publicOrderId as string);
    sendSuccess(res, result, 'Order fetched successfully');
  } catch (error) {
    next(error);
  }
};
