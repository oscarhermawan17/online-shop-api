import { Response, NextFunction } from 'express';

import prisma from '../../../config/prisma';
import { sendSuccess } from '../../../utils/response';
import { CustomerAuthRequest } from '../../../middlewares/customer-auth.middleware';
import { AppError } from '../../../middlewares/error.middleware';

// ─── GET /customer/addresses ─────────────────────────────────────────────────

export const getMyAddresses = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const customerId = req.customer!.customerId;

    const addresses = await prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    sendSuccess(res, addresses, 'Addresses fetched successfully', 200);
  } catch (error) {
    next(error);
  }
};

// ─── POST /customer/addresses ────────────────────────────────────────────────

export const createAddress = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const customerId = req.customer!.customerId;
    const storeId = req.customer!.storeId;
    const { label, recipient, phone, address, district, lat, lng, isDefault } = req.body;

    if (!label || !recipient || !phone || !address) {
      throw new AppError('Label, recipient, phone, and address are required', 400);
    }

    // If this address is set as default, unset other defaults
    if (isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // If this is the first address, make it default
    const existingCount = await prisma.customerAddress.count({ where: { customerId } });
    const shouldBeDefault = isDefault || existingCount === 0;

    const newAddress = await prisma.customerAddress.create({
      data: {
        storeId,
        customerId,
        label,
        recipient,
        phone,
        address,
        district: district || null,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        isDefault: shouldBeDefault,
      },
    });

    sendSuccess(res, newAddress, 'Address created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /customer/addresses/:id ───────────────────────────────────────────

export const updateAddress = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const customerId = req.customer!.customerId;
    const id = req.params.id as string;
    const { label, recipient, phone, address, district, lat, lng, isDefault } = req.body;

    // Verify ownership
    const existing = await prisma.customerAddress.findFirst({
      where: { id, customerId },
    });

    if (!existing) {
      throw new AppError('Address not found', 404);
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.customerAddress.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(recipient !== undefined && { recipient }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(district !== undefined && { district: district || null }),
        ...(lat !== undefined && { lat: lat ? parseFloat(lat) : null }),
        ...(lng !== undefined && { lng: lng ? parseFloat(lng) : null }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    sendSuccess(res, updated, 'Address updated successfully', 200);
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /customer/addresses/:id ──────────────────────────────────────────

export const deleteAddress = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const customerId = req.customer!.customerId;
    const id = req.params.id as string;

    // Verify ownership
    const existing = await prisma.customerAddress.findFirst({
      where: { id, customerId },
    });

    if (!existing) {
      throw new AppError('Address not found', 404);
    }

    await prisma.customerAddress.delete({ where: { id } });

    // If deleted address was default, set the most recent one as default
    if (existing.isDefault) {
      const nextDefault = await prisma.customerAddress.findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
      });

      if (nextDefault) {
        await prisma.customerAddress.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    }

    sendSuccess(res, null, 'Address deleted successfully', 200);
  } catch (error) {
    next(error);
  }
};
