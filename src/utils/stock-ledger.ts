import { Prisma, StockMovementCategory, StockMovementStatus } from '@prisma/client';

import prisma from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

export type StockLedgerClient = Prisma.TransactionClient | typeof prisma;

interface RecordStockMovementInput {
  storeId: string;
  productId: string;
  variantId: string;
  stockStatus: StockMovementStatus;
  quantity: number;
  category: StockMovementCategory;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  createdByAdminId?: string | null;
  createdAt?: Date;
}

export const recordStockMovement = async (
  db: StockLedgerClient,
  input: RecordStockMovementInput,
) => {
  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    throw new AppError('Stock movement quantity must be an integer >= 0', 400);
  }

  return db.stockMovement.create({
    data: {
      storeId: input.storeId,
      productId: input.productId,
      variantId: input.variantId,
      stockStatus: input.stockStatus,
      quantity: input.quantity,
      category: input.category,
      balanceAfter: input.balanceAfter,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      notes: input.notes ?? null,
      createdByAdminId: input.createdByAdminId ?? null,
      createdAt: input.createdAt,
    },
  });
};

interface UpsertInitialStockInput {
  storeId: string;
  productId: string;
  variantId: string;
  quantity: number;
  createdByAdminId?: string | null;
}

export const upsertInitialStockMovement = async (
  db: StockLedgerClient,
  input: UpsertInitialStockInput,
) => {
  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    throw new AppError('Initial stock must be an integer >= 0', 400);
  }

  const existingInitial = await db.stockMovement.findFirst({
    where: {
      storeId: input.storeId,
      productId: input.productId,
      variantId: input.variantId,
      category: 'initial_stock',
    },
    orderBy: { createdAt: 'asc' },
  });

  if (existingInitial) {
    return db.stockMovement.update({
      where: { id: existingInitial.id },
      data: {
        stockStatus: 'in',
        quantity: input.quantity,
        balanceAfter: input.quantity,
        createdByAdminId: input.createdByAdminId ?? existingInitial.createdByAdminId,
      },
    });
  }

  return recordStockMovement(db, {
    storeId: input.storeId,
    productId: input.productId,
    variantId: input.variantId,
    stockStatus: 'in',
    quantity: input.quantity,
    category: 'initial_stock',
    balanceAfter: input.quantity,
    createdByAdminId: input.createdByAdminId,
  });
};

export const ensureInitialStockEditable = async (
  db: StockLedgerClient,
  storeId: string,
  variantId: string,
) => {
  const blockingMovement = await db.stockMovement.findFirst({
    where: {
      storeId,
      variantId,
      category: {
        in: ['sale', 'add_stock'],
      },
    },
    select: { id: true },
  });

  if (blockingMovement) {
    throw new AppError(
      'Stok awal tidak bisa diubah karena sudah ada transaksi atau penambahan stok',
      400,
    );
  }

  const soldOrderItem = await db.orderItem.findFirst({
    where: {
      storeId,
      variantId,
    },
    select: { id: true },
  });

  if (soldOrderItem) {
    throw new AppError(
      'Stok awal tidak bisa diubah karena varian sudah pernah ditransaksikan',
      400,
    );
  }
};
