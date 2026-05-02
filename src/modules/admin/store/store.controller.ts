import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { AppError } from '../../../middlewares/error.middleware';
import { sendSuccess } from '../../../utils/response';
import * as storeService from './store.service';

// ─── GET /admin/store ─────────────────────────────────────────────────────────

export const getStore = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const store = await storeService.getStore(storeId);
    sendSuccess(res, store, 'Store fetched successfully');
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /admin/store ───────────────────────────────────────────────────────

export const updateStore = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const store = await storeService.updateStore(storeId, req.body);
    sendSuccess(res, store, 'Store updated successfully');
  } catch (error) {
    next(error);
  }
};

// ─── PUT /admin/store/bank-accounts ──────────────────────────────────────────

export const updateBankAccounts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { bankAccounts } = req.body;

    if (!Array.isArray(bankAccounts)) {
      throw new AppError('bankAccounts harus berupa array', 400);
    }

    const result = await storeService.upsertBankAccounts(storeId, bankAccounts);
    sendSuccess(res, result, 'Bank accounts updated successfully');
  } catch (error) {
    next(error);
  }
};
