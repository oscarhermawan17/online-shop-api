import bcrypt from 'bcryptjs';

import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateCustomerInput {
  storeId: string;
  name: string;
  phone: string;
  email?: string;
  password: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const listCustomers = async (storeId: string) => {
  return prisma.customer.findMany({
    where: { storeId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const createCustomer = async (input: CreateCustomerInput) => {
  const { storeId, name, phone, email, password } = input;

  // Check for existing phone within the same store
  const existing = await prisma.customer.findUnique({
    where: { storeId_phone: { storeId, phone } },
  });
  if (existing) {
    throw new AppError('Phone number already in use', 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const customer = await prisma.customer.create({
    data: { storeId, name, phone, email: email ?? null, password: hashedPassword },
    select: { id: true, name: true, phone: true, email: true, isActive: true, createdAt: true },
  });

  return customer;
};

export const toggleCustomerStatus = async (customerId: string, storeId: string) => {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, storeId },
  });
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }

  return prisma.customer.update({
    where: { id: customerId },
    data: { isActive: !customer.isActive },
    select: { id: true, isActive: true },
  });
};
