import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { AppError } from './error.middleware';

// ─── JWT Payload Type ─────────────────────────────────────────────────────────

export interface CustomerJwtPayload {
  customerId: string;
  phone: string;
}

// ─── Augment Express Request ──────────────────────────────────────────────────

export interface CustomerAuthRequest extends Request {
  customer?: CustomerJwtPayload;
}

// ─── Customer JWT Auth Middleware ─────────────────────────────────────────────

export const requireCustomerAuth = (
  req: CustomerAuthRequest,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError('Unauthorized: No token provided', 401));
    return;
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.CUSTOMER_JWT_SECRET;

  if (!jwtSecret) {
    next(new AppError('CUSTOMER_JWT_SECRET is not configured on the server', 500));
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as CustomerJwtPayload;
    req.customer = decoded;
    next();
  } catch {
    next(new AppError('Unauthorized: Invalid or expired token', 401));
  }
};
