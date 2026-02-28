import { Request, Response, NextFunction } from 'express';

import { sendSuccess } from '../../utils/response';
import * as authService from './auth.service';

// ─── POST /auth/login ─────────────────────────────────────────────────────────

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { identifier, password } = req.body;

    const result = await authService.login({ identifier, password });

    sendSuccess(res, result, 'Login successful', 200);
  } catch (error) {
    next(error);
  }
};
