import { BankName } from '@prisma/client';

import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

// ─── Constants ────────────────────────────────────────────────────────────────

export const VALID_BANK_NAMES: BankName[] = [
  BankName.BCA,
  BankName.BRI,
  BankName.BNI,
  BankName.Mandiri,
  BankName.BankPapua,
  BankName.BTN,
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpdateStoreInput {
  name?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  footerText?: string;
  whatsappNumber?: string;
  email?: string;
  address?: string;
  qrisImageUrl?: string;
  deliveryRetailMinimumOrder?: number | null;
  deliveryStoreMinimumOrder?: number | null;
  deliveryRetailFreeShippingMinimumOrder?: number | null;
  deliveryStoreFreeShippingMinimumOrder?: number | null;
}

export interface BankAccountInput {
  bankName: BankName;
  accountNumber: string;
  accountHolder: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const withBankAccounts = {
  bankAccounts: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      bankName: true,
      accountNumber: true,
      accountHolder: true,
      sortOrder: true,
    },
  },
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const getStore = async (storeId: string) => {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: withBankAccounts,
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
    include: withBankAccounts,
  });

  return store;
};

export const upsertBankAccounts = async (
  storeId: string,
  accounts: BankAccountInput[],
) => {
  // Validate all entries
  for (const acc of accounts) {
    if (!VALID_BANK_NAMES.includes(acc.bankName)) {
      throw new AppError(
        `Nama bank tidak valid: ${acc.bankName}. Pilihan: ${VALID_BANK_NAMES.join(', ')}`,
        400,
      );
    }
    if (!acc.accountNumber?.trim()) {
      throw new AppError('Nomor rekening tidak boleh kosong', 400);
    }
    if (!acc.accountHolder?.trim()) {
      throw new AppError('Nama pemilik rekening tidak boleh kosong', 400);
    }
  }

  // Replace all in a single transaction
  const [, updatedStore] = await prisma.$transaction([
    prisma.storeBankAccount.deleteMany({ where: { storeId } }),
    prisma.store.update({
      where: { id: storeId },
      data: {
        bankAccounts: {
          create: accounts.map((acc, index) => ({
            bankName: acc.bankName,
            accountNumber: acc.accountNumber.trim(),
            accountHolder: acc.accountHolder.trim(),
            sortOrder: index,
          })),
        },
      },
      include: withBankAccounts,
    }),
  ]);

  return updatedStore.bankAccounts;
};
