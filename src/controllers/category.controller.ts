import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess } from '../utils/response';
import prisma from '../config/prisma';

export const listCategories = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      where: { storeId: req.user!.storeId },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, categories, 'Categories fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const publicListCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = typeof req.query.storeId === 'string' ? req.query.storeId : undefined;
    const whereClause = storeId ? { storeId } : {};
    
    const categories = await prisma.category.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, categories, 'Categories fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const getCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const category = await prisma.category.findFirst({
      where: { id: req.params.id as string as string, storeId: req.user!.storeId },
    });
    if (!category) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }
    sendSuccess(res, category, 'Category fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, icon } = req.body;
    const category = await prisma.category.create({
      data: {
        storeId: req.user!.storeId,
        name,
        icon,
      },
    });
    sendSuccess(res, category, 'Category created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, icon } = req.body;
    const existingCategory = await prisma.category.findFirst({
      where: { id: req.params.id as string as string, storeId: req.user!.storeId },
    });
    if (!existingCategory) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }
    const category = await prisma.category.update({
      where: { id: req.params.id as string as string },
      data: { name, icon },
    });
    sendSuccess(res, category, 'Category updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const existingCategory = await prisma.category.findFirst({
      where: { id: req.params.id as string as string, storeId: req.user!.storeId },
    });
    if (!existingCategory) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }
    await prisma.category.delete({
      where: { id: req.params.id as string as string },
    });
    sendSuccess(res, null, 'Category deleted successfully');
  } catch (error) {
    next(error);
  }
};
