import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

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

export interface ListCustomersParams {
  storeId: string;
  page: number;
  limit: number;
  search?: string;
  status?: 'active' | 'inactive';
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const listCustomers = async (params: ListCustomersParams) => {
  const { storeId, page, limit, search, status } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.CustomerWhereInput = {
    storeId,
    ...(status !== undefined && { isActive: status === 'active' }),
    ...(search && {
      OR: [
        { name:  { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return { customers, total };
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
