import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

export interface ShippingShiftInput {
  name: string;
  startTime: string;
  endTime: string;
  isActive?: boolean;
}

const normalizeInput = (data: ShippingShiftInput) => ({
  name: data.name.trim(),
  startTime: data.startTime,
  endTime: data.endTime,
  isActive: data.isActive ?? true,
});

const validateShiftInput = (data: ShippingShiftInput) => {
  const normalized = normalizeInput(data);

  if (!normalized.name) {
    throw new AppError('Shift name is required', 400);
  }

  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timePattern.test(normalized.startTime) || !timePattern.test(normalized.endTime)) {
    throw new AppError('Shift time must use HH:mm format', 400);
  }

  if (normalized.endTime <= normalized.startTime) {
    throw new AppError('Shift end time must be after start time', 400);
  }

  return normalized;
};

export const getShippingShifts = async (storeId: string) => {
  return prisma.shippingShift.findMany({
    where: { storeId },
    orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }, { name: 'asc' }],
  });
};

export const createShippingShift = async (
  storeId: string,
  data: ShippingShiftInput,
) => {
  const normalized = validateShiftInput(data);

  const existing = await prisma.shippingShift.findFirst({
    where: {
      storeId,
      name: normalized.name,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
    },
  });

  if (existing) {
    throw new AppError('Shipping shift already exists', 409);
  }

  return prisma.shippingShift.create({
    data: {
      storeId,
      ...normalized,
    },
  });
};

export const updateShippingShift = async (
  storeId: string,
  shiftId: string,
  data: ShippingShiftInput,
) => {
  const normalized = validateShiftInput(data);

  const existing = await prisma.shippingShift.findFirst({
    where: {
      id: shiftId,
      storeId,
    },
  });

  if (!existing) {
    throw new AppError('Shipping shift not found', 404);
  }

  const duplicate = await prisma.shippingShift.findFirst({
    where: {
      storeId,
      id: { not: shiftId },
      name: normalized.name,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
    },
  });

  if (duplicate) {
    throw new AppError('Another shipping shift with the same schedule already exists', 409);
  }

  return prisma.shippingShift.update({
    where: { id: shiftId },
    data: normalized,
  });
};

export const deleteShippingShift = async (storeId: string, shiftId: string) => {
  const existing = await prisma.shippingShift.findFirst({
    where: {
      id: shiftId,
      storeId,
    },
    include: {
      assignments: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!existing) {
    throw new AppError('Shipping shift not found', 404);
  }

  if (existing.assignments.length > 0) {
    throw new AppError(
      'Shipping shift cannot be deleted because it is already used by orders',
      400,
    );
  }

  await prisma.shippingShift.delete({
    where: { id: shiftId },
  });
};
