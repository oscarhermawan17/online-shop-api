import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import prisma from '../../config/prisma';
import { AppError } from '../../middlewares/error.middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoginInput {
  identifier: string; // phone or email
  password: string;
}

export interface LoginResult {
  token: string;
  admin: {
    id: string;
    name: string;
    role: string;
    storeId: string;
  };
}

export interface JwtPayload {
  adminId: string;
  storeId: string;
  role: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const login = async (input: LoginInput): Promise<LoginResult> => {
  const { identifier, password } = input;

  // Find admin by phone OR email
  const admin = await prisma.admin.findFirst({
    where: {
      OR: [{ phone: identifier }, { email: identifier }],
    },
  });

  if (!admin) {
    throw new AppError('Invalid credentials', 401);
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, admin.password);
  if (!isValidPassword) {
    throw new AppError('Invalid credentials', 401);
  }

  // Generate JWT
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError('JWT_SECRET is not configured', 500);
  }

  const payload: JwtPayload = {
    adminId: admin.id,
    storeId: admin.storeId,
    role: admin.role,
  };

  const token = jwt.sign(payload, jwtSecret, { expiresIn: '7d' });

  return {
    token,
    admin: {
      id: admin.id,
      name: admin.name,
      role: admin.role,
      storeId: admin.storeId,
    },
  };
};
