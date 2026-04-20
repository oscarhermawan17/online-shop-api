import { StockMovementCategory } from '@prisma/client';

import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';
import { recordStockMovement } from '../../../utils/stock-ledger';

const CATEGORY_LABELS: Record<StockMovementCategory, string> = {
  initial_stock: 'stok awal',
  add_stock: 'tambah stok',
  sale: 'penjualan',
  restore: 'restore',
};

const STATUS_LABELS = {
  in: 'in',
  out: 'out',
} as const;

export interface ListStockMovementsInput {
  storeId: string;
  startDate?: Date;
  endDateExclusive?: Date;
  productId?: string;
  variantId?: string;
  category?: StockMovementCategory;
}

export interface AddStockAdjustmentInput {
  storeId: string;
  adminId?: string;
  variantId: string;
  quantity: number;
  notes?: string;
  addedAt?: Date;
}

export const toMovementResponse = (
  movement: {
    id: string;
    createdAt: Date;
    productId: string;
    variantId: string;
    stockStatus: 'in' | 'out';
    quantity: number;
    category: StockMovementCategory;
    balanceAfter: number;
    notes: string | null;
    referenceType: string | null;
    referenceId: string | null;
    product: { name: string };
    variant: { name: string | null };
    createdByAdmin: { email: string | null } | null;
  },
) => ({
  id: movement.id,
  createdAt: movement.createdAt,
  productId: movement.productId,
  productName: movement.product.name,
  variantId: movement.variantId,
  variantName: movement.variant.name,
  stockStatus: movement.stockStatus,
  stockStatusLabel: STATUS_LABELS[movement.stockStatus],
  category: movement.category,
  categoryLabel: CATEGORY_LABELS[movement.category],
  quantity: movement.quantity,
  inQty: movement.stockStatus === 'in' ? movement.quantity : 0,
  outQty: movement.stockStatus === 'out' ? movement.quantity : 0,
  stock: movement.balanceAfter,
  notes: movement.notes,
  referenceType: movement.referenceType,
  referenceId: movement.referenceId,
  createdByAdmin: movement.createdByAdmin?.email ?? null,
});

export const listStockMovements = async (input: ListStockMovementsInput) => {
  const { storeId, startDate, endDateExclusive, productId, variantId, category } = input;

  const where = {
    storeId,
    ...(productId ? { productId } : {}),
    ...(variantId ? { variantId } : {}),
    ...(category ? { category } : {}),
    ...(startDate || endDateExclusive
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDateExclusive ? { lt: endDateExclusive } : {}),
          },
        }
      : {}),
  };

  const movements = await prisma.stockMovement.findMany({
    where,
    include: {
      product: {
        select: {
          name: true,
        },
      },
      variant: {
        select: {
          name: true,
        },
      },
      createdByAdmin: {
        select: {
          email: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  return movements.map(toMovementResponse);
};

export const addStockAdjustment = async (input: AddStockAdjustmentInput) => {
  const {
    storeId,
    adminId,
    variantId,
    quantity,
    notes,
    addedAt,
  } = input;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError('Jumlah penambahan stok harus bilangan bulat lebih dari 0', 400);
  }

  return prisma.$transaction(async (tx) => {
    const variant = await tx.variant.findFirst({
      where: {
        id: variantId,
        storeId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!variant) {
      throw new AppError('Varian tidak ditemukan', 404);
    }

    const updatedVariant = await tx.variant.update({
      where: { id: variant.id },
      data: {
        stock: {
          increment: quantity,
        },
      },
      select: {
        stock: true,
      },
    });

    const movement = await recordStockMovement(tx, {
      storeId,
      productId: variant.product.id,
      variantId: variant.id,
      stockStatus: 'in',
      quantity,
      category: 'add_stock',
      balanceAfter: updatedVariant.stock,
      notes: notes?.trim() || null,
      createdByAdminId: adminId ?? null,
      createdAt: addedAt,
    });

    return toMovementResponse({
      ...movement,
      product: {
        name: variant.product.name,
      },
      variant: {
        name: variant.name,
      },
      createdByAdmin: null,
    });
  });
};
