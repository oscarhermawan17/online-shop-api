import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess } from '../utils/response';
import prisma from '../config/prisma';

export const listUnits = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const units = await prisma.unit.findMany({
      where: { storeId: req.user!.storeId },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, units, 'Units fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const getUnit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const unit = await prisma.unit.findFirst({
      where: { id: req.params.id as string as string, storeId: req.user!.storeId },
    });
    if (!unit) {
      res.status(404).json({ success: false, message: 'Unit not found' });
      return;
    }
    sendSuccess(res, unit, 'Unit fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const createUnit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name } = req.body;
    const unit = await prisma.unit.create({
      data: {
        storeId: req.user!.storeId,
        name,
      },
    });
    sendSuccess(res, unit, 'Unit created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateUnit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name } = req.body;
    const existingUnit = await prisma.unit.findFirst({
      where: { id: req.params.id as string as string, storeId: req.user!.storeId },
    });
    if (!existingUnit) {
      res.status(404).json({ success: false, message: 'Unit not found' });
      return;
    }
    const unit = await prisma.unit.update({
      where: { id: req.params.id as string as string },
      data: { name },
    });
    sendSuccess(res, unit, 'Unit updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteUnit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const existingUnit = await prisma.unit.findFirst({
      where: { id: req.params.id as string as string, storeId: req.user!.storeId },
    });
    if (!existingUnit) {
      res.status(404).json({ success: false, message: 'Unit not found' });
      return;
    }
    await prisma.unit.delete({
      where: { id: req.params.id as string as string },
    });
    sendSuccess(res, null, 'Unit deleted successfully');
  } catch (error) {
    next(error);
  }
};
