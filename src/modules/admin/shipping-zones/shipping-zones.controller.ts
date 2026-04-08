import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middlewares/auth.middleware';
import { sendSuccess } from '../../../utils/response';
import * as shippingZonesService from './shipping-zones.service';

// ─── GET /admin/shipping-zones ───────────────────────────────────────────────

export const getShippingZones = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const zones = await shippingZonesService.getShippingZones(storeId);
    sendSuccess(res, zones, 'Shipping zones fetched successfully');
  } catch (error) {
    next(error);
  }
};

// ─── PUT /admin/shipping-zones (bulk upsert) ────────────────────────────────

export const bulkUpsertShippingZones = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { zones } = req.body as {
      zones: { name: string; cost: number; isActive?: boolean }[];
    };
    const results = await shippingZonesService.bulkUpsertShippingZones(
      storeId,
      zones,
    );
    sendSuccess(res, results, 'Shipping zones updated successfully');
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /admin/shipping-zones/:id ─────────────────────────────────────────

export const updateShippingZone = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { name, cost, isActive } = req.body;
    const zone = await shippingZonesService.upsertShippingZone(storeId, {
      name,
      cost,
      isActive,
    });
    sendSuccess(res, zone, 'Shipping zone updated successfully');
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /admin/shipping-zones/:id ────────────────────────────────────────

export const deleteShippingZone = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    await shippingZonesService.deleteShippingZone(storeId, req.params.id as string);
    sendSuccess(res, null, 'Shipping zone deleted successfully');
  } catch (error) {
    next(error);
  }
};
