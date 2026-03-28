import bcrypt from 'bcryptjs';

import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string;
  password: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const createCustomer = async (input: CreateCustomerInput) => {
  const { name, phone, email, password } = input;

  // Check for existing phone
  const existing = await prisma.customer.findUnique({ where: { phone } });
  if (existing) {
    throw new AppError('Phone number already in use', 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const customer = await prisma.customer.create({
    data: { name, phone, email: email ?? null, password: hashedPassword },
    select: { id: true, name: true, phone: true, email: true, createdAt: true },
  });

  return customer;
};
