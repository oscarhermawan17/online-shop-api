import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';
import { sendSuccess } from '../../utils/response';

const router = Router();

// GET /shipping-zones — public, returns active zones for the store
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const store = await prisma.store.findFirst({ select: { id: true } });
    if (!store) {
      res.status(404).json({ success: false, message: 'Store not found' });
      return;
    }

    const zones = await prisma.shippingZone.findMany({
      where: { storeId: store.id, isActive: true },
      select: { name: true, cost: true },
      orderBy: { name: 'asc' },
    });

    sendSuccess(res, zones, 'Shipping zones fetched successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
