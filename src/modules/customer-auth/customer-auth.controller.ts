import { Request, Response, NextFunction } from 'express';

import { sendSuccess } from '../../utils/response';
import * as customerAuthService from './customer-auth.service';

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { identifier, password } = req.body;
    const result = await customerAuthService.login({ identifier, password });
    sendSuccess(res, result, 'Login successful', 200);
  } catch (error) {
    next(error);
  }
};
