import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { sendSuccess } from '../../utils/response';

// ─── GET /store ───────────────────────────────────────────────────────────────

export const getPublicStore = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const store = await prisma.store.findFirst({
      select: {
        name: true,
        description: true,
        address: true,
        deliveryRetailMinimumOrder: true,
        deliveryStoreMinimumOrder: true,
        deliveryRetailFreeShippingMinimumOrder: true,
        deliveryStoreFreeShippingMinimumOrder: true,
      },
    });
    if (!store) {
      res.status(404).json({ success: false, message: 'Store not found' });
      return;
    }
    sendSuccess(res, store, 'Store fetched successfully');
  } catch (error) {
    next(error);
  }
};
