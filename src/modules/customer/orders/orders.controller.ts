import { Response, NextFunction } from 'express';

import { AppError } from '../../../middlewares/error.middleware';
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

export const completeMyOrder = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const customerId = req.customer!.customerId;
    const orderId = req.params.id as string;

    const order = await ordersService.completeOrder(customerId, orderId);

    sendSuccess(res, order, 'Konfirmasi selesai pesanan berhasil disimpan', 200);
  } catch (error) {
    next(error);
  }
};

export const createMyOrderComplaint = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const customerId = req.customer!.customerId;
    const orderId = req.params.id as string;
    const { comment, evidenceImageUrls } = req.body as {
      comment?: unknown;
      evidenceImageUrls?: unknown;
    };

    if (typeof comment !== 'string') {
      throw new AppError('Komentar komplain wajib diisi', 400);
    }

    if (!Array.isArray(evidenceImageUrls) || evidenceImageUrls.some((item) => typeof item !== 'string')) {
      throw new AppError('Format bukti gambar komplain tidak valid', 400);
    }

    const complaint = await ordersService.createOrderComplaint(customerId, orderId, {
      comment,
      evidenceImageUrls,
    });

    sendSuccess(res, complaint, 'Komplain pesanan berhasil dikirim', 201);
  } catch (error) {
    next(error);
  }
};
