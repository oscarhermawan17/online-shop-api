import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AdminRole } from '@prisma/client';

import { AppError } from './error.middleware';

// ─── JWT Payload Type ─────────────────────────────────────────────────────────

export interface JwtPayload {
  adminId: string;
  storeId: string;
  role: AdminRole;
}

// ─── Augment Express Request ──────────────────────────────────────────────────

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// ─── RBAC Permission Map ──────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  owner: 3,
  manager: 2,
  staff: 1,
};

// ─── JWT Auth Middleware ──────────────────────────────────────────────────────
// Validates the Bearer token from the Authorization header.

export const requireAuth = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError('Unauthorized: No token provided', 401));
    return;
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    next(new AppError('JWT_SECRET is not configured on the server', 500));
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    next(new AppError('Unauthorized: Invalid or expired token', 401));
  }
};

// ─── Role-Based Access Control Middleware ─────────────────────────────────────
// Usage: requireRole('manager') allows owner and manager
// Usage: requireRole('owner') allows only owner

export const requireRole = (...allowedRoles: AdminRole[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Unauthorized: No user context', 401));
      return;
    }

    const userRole = req.user.role;

    // Check if user's role is in allowed roles
    const hasPermission = allowedRoles.some(
      (allowedRole) => ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[allowedRole],
    );

    if (!hasPermission) {
      next(new AppError('Forbidden: Insufficient permissions', 403));
      return;
    }

    next();
  };
};

// Legacy alias for backward compatibility
export const authMiddleware = requireAuth;
