import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

export interface ShippingDriverInput {
  name: string;
  isActive?: boolean;
}

const normalizeInput = (data: ShippingDriverInput) => ({
  name: data.name.trim(),
  isActive: data.isActive ?? true,
});

const validateDriverInput = (data: ShippingDriverInput) => {
  const normalized = normalizeInput(data);

  if (!normalized.name) {
    throw new AppError('Driver name is required', 400);
  }

  return normalized;
};

export const getShippingDrivers = async (storeId: string) => {
  return prisma.shippingDriver.findMany({
    where: { storeId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
};

export const createShippingDriver = async (
  storeId: string,
  data: ShippingDriverInput,
) => {
  const normalized = validateDriverInput(data);

  const existing = await prisma.shippingDriver.findFirst({
    where: {
      storeId,
      name: normalized.name,
    },
  });

  if (existing) {
    throw new AppError('Shipping driver already exists', 409);
  }

  return prisma.shippingDriver.create({
    data: {
      storeId,
      ...normalized,
    },
  });
};

export const updateShippingDriver = async (
  storeId: string,
  driverId: string,
  data: ShippingDriverInput,
) => {
  const normalized = validateDriverInput(data);

  const existing = await prisma.shippingDriver.findFirst({
    where: {
      id: driverId,
      storeId,
    },
  });

  if (!existing) {
    throw new AppError('Shipping driver not found', 404);
  }

  const duplicate = await prisma.shippingDriver.findFirst({
    where: {
      storeId,
      id: { not: driverId },
      name: normalized.name,
    },
  });

  if (duplicate) {
    throw new AppError('Another shipping driver with the same name already exists', 409);
  }

  return prisma.shippingDriver.update({
    where: { id: driverId },
    data: normalized,
  });
};

export const deleteShippingDriver = async (storeId: string, driverId: string) => {
  const existing = await prisma.shippingDriver.findFirst({
    where: {
      id: driverId,
      storeId,
    },
  });

  if (!existing) {
    throw new AppError('Shipping driver not found', 404);
  }

  await prisma.shippingDriver.delete({
    where: { id: driverId },
  });
};
