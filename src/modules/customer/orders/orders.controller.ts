import { Response, NextFunction } from 'express';

import prisma from '../../../config/prisma';
import { sendSuccess } from '../../../utils/response';
import { CustomerAuthRequest } from '../../../middlewares/customer-auth.middleware';

export const getMyOrders = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const customerId = req.customer!.customerId;

    const orders = await prisma.order.findMany({
      where: { customerId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, orders, 'Orders fetched successfully', 200);
  } catch (error) {
    next(error);
  }
};
