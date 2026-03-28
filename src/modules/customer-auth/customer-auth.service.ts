import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import prisma from '../../config/prisma';
import { AppError } from '../../middlewares/error.middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerLoginInput {
  identifier: string; // phone or email
  password: string;
}

export interface CustomerJwtPayload {
  customerId: string;
  phone: string;
}

export interface CustomerLoginResult {
  token: string;
  customer: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const login = async (input: CustomerLoginInput): Promise<CustomerLoginResult> => {
  const { identifier, password } = input;

  // Find customer by phone OR email
  const customer = await prisma.customer.findFirst({
    where: {
      OR: [{ phone: identifier }, { email: identifier }],
    },
  });

  // No account or guest account (no password) → same generic error
  if (!customer || customer.password === null) {
    throw new AppError('Invalid credentials', 401);
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, customer.password);
  if (!isValidPassword) {
    throw new AppError('Invalid credentials', 401);
  }

  // Generate JWT
  const jwtSecret = process.env.CUSTOMER_JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError('CUSTOMER_JWT_SECRET is not configured', 500);
  }

  const payload: CustomerJwtPayload = {
    customerId: customer.id,
    phone: customer.phone,
  };

  const token = jwt.sign(payload, jwtSecret, { expiresIn: '7d' });

  return {
    token,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    },
  };
};
