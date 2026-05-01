import { StockMovementCategory } from '@prisma/client';
import { NextFunction, Response } from 'express';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { AppError } from '../../../middlewares/error.middleware';
import { sendSuccess } from '../../../utils/response';
import { sendXls } from '../../../utils/xls';
import * as inventoryService from './inventory.service';

const toIsoDateTime = (value: Date): string => value.toISOString().replace('T', ' ').slice(0, 19);

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

const parseDateBody = (value: unknown, fieldName: string): Date | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new AppError(`Format ${fieldName} harus YYYY-MM-DD atau ISO datetime`, 400);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const now = new Date();
    const parsed = new Date(
      year,
      month - 1,
      day,
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    );

    if (Number.isNaN(parsed.getTime())) {
      throw new AppError(`${fieldName} tidak valid`, 400);
    }

    return parsed;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Format ${fieldName} harus YYYY-MM-DD atau ISO datetime`, 400);
  }

  return parsed;
};

const parseCategory = (value: unknown): StockMovementCategory | undefined => {
  const raw = readQueryString(value);

  if (!raw || raw === 'all') {
    return undefined;
  }

  if (
    raw !== 'initial_stock'
    && raw !== 'add_stock'
    && raw !== 'sale'
    && raw !== 'restore'
  ) {
    throw new AppError('Kategori mutasi stok tidak valid', 400);
  }

  return raw;
};

const parseFilters = (req: AuthRequest) => {
  const startDate = parseDateQuery(req.query.startDate, 'startDate');
  const endDate = parseDateQuery(req.query.endDate, 'endDate');
  const endDateExclusive = endDate
    ? new Date(endDate.getTime() + (24 * 60 * 60 * 1000))
    : undefined;

  if (startDate && endDate && endDate < startDate) {
    throw new AppError('endDate harus sama atau setelah startDate', 400);
  }

  return {
    startDate,
    endDate,
    endDateExclusive,
    productId: readQueryString(req.query.productId),
    variantId: readQueryString(req.query.variantId),
    category: parseCategory(req.query.category),
  };
};

export const listStockMovements = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const filters = parseFilters(req);

    const movements = await inventoryService.listStockMovements({
      storeId: req.user!.storeId,
      startDate: filters.startDate,
      endDateExclusive: filters.endDateExclusive,
      productId: filters.productId,
      variantId: filters.variantId,
      category: filters.category,
    });

    sendSuccess(res, movements, 'Stock movements fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const exportStockMovements = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const filters = parseFilters(req);

    const movements = await inventoryService.listStockMovements({
      storeId: req.user!.storeId,
      startDate: filters.startDate,
      endDateExclusive: filters.endDateExclusive,
      productId: filters.productId,
      variantId: filters.variantId,
      category: filters.category,
    });

    sendXls(res, {
      filename: `inventory-stock-history-${new Date().toISOString().slice(0, 10)}.xls`,
      sheetName: 'Inventory Stock History',
      table: {
        title: 'Laporan Histori Stok / Inventory',
        subtitle: 'Mutasi stok berdasarkan filter tanggal dan varian.',
        metadata: [
          { label: 'Start Date', value: filters.startDate ? toIsoDateTime(filters.startDate) : '-' },
          { label: 'End Date', value: filters.endDate ? toIsoDateTime(filters.endDate) : '-' },
          { label: 'Product ID', value: filters.productId ?? '-' },
          { label: 'Variant ID', value: filters.variantId ?? '-' },
          { label: 'Kategori', value: filters.category ?? 'all' },
          { label: 'Jumlah Baris', value: movements.length },
          { label: 'Generated At', value: toIsoDateTime(new Date()) },
        ],
        headers: [
          'Tanggal',
          'Id Product',
          'Nama Product',
          'Id Variant',
          'Nama Variant',
          'stock_status',
          'in',
          'out',
          'kategori',
          'stock',
          'catatan',
        ],
        rows: movements.map((movement: (typeof movements)[number]) => [
          toIsoDateTime(new Date(movement.createdAt)),
          movement.productId,
          movement.productName,
          movement.variantId,
          movement.variantName ?? '-',
          movement.stockStatusLabel,
          movement.inQty > 0 ? movement.inQty : '',
          movement.outQty > 0 ? movement.outQty : '',
          movement.categoryLabel,
          movement.stock,
          movement.notes ?? '-',
        ]),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const addStockAdjustment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await inventoryService.addStockAdjustment({
      storeId: req.user!.storeId,
      adminId: req.user!.adminId,
      variantId: String(req.body.variantId),
      quantity: Number(req.body.quantity),
      notes: req.body.notes ? String(req.body.notes) : undefined,
      addedAt: parseDateBody(req.body.addedAt, 'addedAt'),
    });

    sendSuccess(res, result, 'Stock added successfully', 201);
  } catch (error) {
    next(error);
  }
};
