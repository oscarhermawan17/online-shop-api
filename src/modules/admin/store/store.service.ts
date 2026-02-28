import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpdateStoreInput {
  name?: string;
  logoUrl?: string;
  bannerUrl?: string;
  footerText?: string;
  whatsappNumber?: string;
  email?: string;
  address?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  qrisImageUrl?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const getStore = async (storeId: string) => {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
  });

  if (!store) {
    throw new AppError('Store not found', 404);
  }

  return store;
};

export const updateStore = async (storeId: string, data: UpdateStoreInput) => {
  const store = await prisma.store.update({
    where: { id: storeId },
    data,
  });

  return store;
};
