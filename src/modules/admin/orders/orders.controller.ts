import { Response, NextFunction } from 'express';
import { OrderStatus } from '@prisma/client';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { sendSuccess } from '../../../utils/response';
import * as ordersService from './orders.service';

// ─── GET /admin/orders ────────────────────────────────────────────────────────

export const listOrders = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const status = req.query.status as OrderStatus | undefined;
    const orders = await ordersService.listOrders(req.user!.storeId, status);
    sendSuccess(res, orders, 'Orders fetched successfully');
  } catch (error) {
    next(error);
  }
};

// ─── GET /admin/orders/:id ────────────────────────────────────────────────────

export const getOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const order = await ordersService.getOrder(req.user!.storeId, req.params.id as string);
    sendSuccess(res, order, 'Order fetched successfully');
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /admin/orders/:id/confirm ──────────────────────────────────────────

export const confirmPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const order = await ordersService.confirmPayment(
      req.user!.storeId,
      req.params.id as string,
    );
    sendSuccess(res, order, 'Payment confirmed successfully');
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /admin/orders/:id/settle-credit ─────────────────────────────────────

export const settleCredit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const order = await ordersService.settleCredit(
      req.user!.storeId,
      req.params.id as string,
    );
    sendSuccess(res, order, 'Credit invoice settled successfully');
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /admin/orders/:id/status ───────────────────────────────────────────

export const updateOrderStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { status } = req.body;
    const order = await ordersService.updateOrderStatus(
      req.user!.storeId,
      req.params.id as string,
      status,
    );
    sendSuccess(res, order, 'Order status updated successfully');
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /admin/orders/:id/ship ─────────────────────────────────────────────

export const shipOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { shiftId, deliveryDate, driverName } = req.body;
    const order = await ordersService.shipOrder(
      req.user!.storeId,
      req.params.id as string,
      {
        shiftId,
        deliveryDate,
        driverName,
        assignedByAdminId: req.user!.adminId,
      },
    );
    sendSuccess(res, order, 'Order shipping scheduled successfully');
  } catch (error) {
    next(error);
  }
};
