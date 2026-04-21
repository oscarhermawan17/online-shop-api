import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { CustomerType } from '@prisma/client';

import prisma from '../../config/prisma';
import { AppError } from '../../middlewares/error.middleware';
import { CustomerJwtPayload } from '../../middlewares/customer-auth.middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerLoginInput {
  storeId: string;
  identifier: string; // phone or email
  password: string;
}

export interface CustomerRegisterInput {
  storeId: string;
  name: string;
  phone: string;
  email?: string;
  password: string;
}

export interface ChangePasswordInput {
  customerId: string;
  storeId: string;
  currentPassword: string;
  newPassword: string;
}

export interface CustomerLoginResult {
  token: string;
  customer: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    type: CustomerType;
  };
}

export interface CurrentCustomerResult {
  customer: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    type: CustomerType;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const login = async (input: CustomerLoginInput): Promise<CustomerLoginResult> => {
  const { storeId, identifier, password } = input;

  // Find customer by phone OR email within the store
  const customer = await prisma.customer.findFirst({
    where: {
      storeId,
      OR: [{ phone: identifier }, { email: identifier }],
    },
  });

  // No account or guest account (no password) → same generic error
  if (!customer || customer.password === null) {
    throw new AppError('Invalid credentials', 401);
  }

  if (!customer.isActive) {
    throw new AppError('Akun pelanggan ini sedang dinonaktifkan', 403);
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
    storeId: customer.storeId,
  };

  const token = jwt.sign(payload, jwtSecret, { expiresIn: '7d' });

  return {
    token,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      type: customer.type,
    },
  };
};

export const register = async (input: CustomerRegisterInput): Promise<CustomerLoginResult> => {
  const { storeId, name, phone, email, password } = input;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true },
  });

  if (!store) {
    throw new AppError('Store not found', 404);
  }

  const existingCustomer = await prisma.customer.findUnique({
    where: { storeId_phone: { storeId, phone } },
  });

  if (existingCustomer?.password) {
    throw new AppError('Nomor HP sudah terdaftar. Silakan login.', 409);
  }

  if (email) {
    const existingEmailCustomer = await prisma.customer.findFirst({
      where: {
        storeId,
        email,
        ...(existingCustomer ? { id: { not: existingCustomer.id } } : {}),
      },
      select: { id: true },
    });

    if (existingEmailCustomer) {
      throw new AppError('Email sudah digunakan oleh akun lain', 409);
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const customer = existingCustomer
    ? await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: {
          name,
          email: email ?? null,
          password: hashedPassword,
          type: 'base',
          isActive: true,
        },
      })
    : await prisma.customer.create({
        data: {
          storeId,
          name,
          phone,
          email: email ?? null,
          password: hashedPassword,
          type: 'base',
        },
      });

  return login({
    storeId,
    identifier: customer.phone,
    password,
  });
};

export const getCurrentCustomer = async (
  customerId: string,
  storeId: string,
): Promise<CurrentCustomerResult> => {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      storeId,
      password: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      type: true,
      isActive: true,
    },
  });

  if (!customer) {
    throw new AppError('Customer not found', 404);
  }

  if (!customer.isActive) {
    throw new AppError('Akun pelanggan ini sedang dinonaktifkan', 403);
  }

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      type: customer.type,
    },
  };
};

export const changePassword = async (input: ChangePasswordInput): Promise<void> => {
  const { customerId, storeId, currentPassword, newPassword } = input;

  if (!currentPassword) {
    throw new AppError('Password saat ini wajib diisi', 400);
  }

  if (!newPassword || newPassword.length < 6) {
    throw new AppError('Password baru minimal 6 karakter', 400);
  }

  if (currentPassword === newPassword) {
    throw new AppError('Password baru harus berbeda dari password saat ini', 400);
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      storeId,
      password: {
        not: null,
      },
    },
    select: {
      id: true,
      password: true,
      isActive: true,
    },
  });

  if (!customer || !customer.password) {
    throw new AppError('Customer not found', 404);
  }

  if (!customer.isActive) {
    throw new AppError('Akun pelanggan ini sedang dinonaktifkan', 403);
  }

  const isValidCurrentPassword = await bcrypt.compare(currentPassword, customer.password);
  if (!isValidCurrentPassword) {
    throw new AppError('Password saat ini tidak sesuai', 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      password: hashedPassword,
    },
  });
};
