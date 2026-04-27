import { Response, NextFunction } from 'express';
import { OrderStatus } from '@prisma/client';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { AppError } from '../../../middlewares/error.middleware';
import { sendSuccess } from '../../../utils/response';
import * as ordersService from './orders.service';

const readQueryString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return undefined;
};

const parseDateQuery = (value: unknown, fieldName: string): Date | undefined => {
  const raw = readQueryString(value);

  if (!raw) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new AppError(`Format ${fieldName} harus YYYY-MM-DD`, 400);
  }

  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`${fieldName} tidak valid`, 400);
  }

  return parsed;
};

const parseOrderStatusQuery = (value: unknown): OrderStatus | undefined => {
  const raw = readQueryString(value);

  if (!raw || raw === 'all') {
    return undefined;
  }

  const allowedStatuses: OrderStatus[] = [
    'pending_payment',
    'waiting_confirmation',
    'paid',
    'shipped',
    'done',
    'expired_unpaid',
    'cancelled',
  ];

  if (!allowedStatuses.includes(raw as OrderStatus)) {
    throw new AppError('Status order tidak valid', 400);
  }

  return raw as OrderStatus;
};

const parseComplaintStatus = (value: unknown): 'accepted' | 'rejected' | 'resolved' => {
  if (value === 'accepted' || value === 'rejected' || value === 'resolved') {
    return value;
  }

  throw new AppError('Status komplain tidak valid', 400);
};

// ─── GET /admin/orders ────────────────────────────────────────────────────────

export const listOrders = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const status = parseOrderStatusQuery(req.query.status);
    const startDate = parseDateQuery(req.query.startDate, 'startDate');
    const endDate = parseDateQuery(req.query.endDate, 'endDate');

    if (startDate && endDate && endDate < startDate) {
      throw new AppError('endDate harus sama atau setelah startDate', 400);
    }

    const endDateExclusive = endDate
      ? new Date(endDate.getTime() + (24 * 60 * 60 * 1000))
      : undefined;

    const orders = await ordersService.listOrders({
      storeId: req.user!.storeId,
      status,
      startDate,
      endDateExclusive,
    });
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

// ─── PATCH /admin/orders/:id/complaints/:complaintId/status ───────────────────

export const updateComplaintStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { status, adminNote } = req.body;
    const order = await ordersService.updateComplaintStatus(
      req.user!.storeId,
      req.params.id as string,
      req.params.complaintId as string,
      {
        status: parseComplaintStatus(status),
        adminNote,
        adminId: req.user!.adminId,
      },
    );
    sendSuccess(res, order, 'Status komplain berhasil diperbarui');
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
