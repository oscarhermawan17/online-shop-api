import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../../middlewares/auth.middleware';
import { sendSuccess } from '../../../utils/response';
import * as productsService from './products.service';

// ─── GET /admin/products ──────────────────────────────────────────────────────

export const listProducts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const products = await productsService.listProducts(req.user!.storeId);
    sendSuccess(res, products, 'Products fetched successfully');
  } catch (error) {
    next(error);
  }
};

// ─── GET /admin/products/:id ──────────────────────────────────────────────────

export const getProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const product = await productsService.getProduct(
      req.user!.storeId,
      req.params.id as string,
    );
    sendSuccess(res, product, 'Product fetched successfully');
  } catch (error) {
    next(error);
  }
};

// ─── POST /admin/products ─────────────────────────────────────────────────────

export const createProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const product = await productsService.createProduct(req.user!.storeId, req.body);
    sendSuccess(res, product, 'Product created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /admin/products/:id ────────────────────────────────────────────────

export const updateProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const product = await productsService.updateProduct(
      req.user!.storeId,
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, product, 'Product updated successfully');
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /admin/products/:id ───────────────────────────────────────────────

export const deleteProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await productsService.deleteProduct(req.user!.storeId, req.params.id as string);
    sendSuccess(res, null, 'Product deleted successfully');
  } catch (error) {
    next(error);
  }
};

// ─── POST /admin/products/:id/images ──────────────────────────────────────────

export const addProductImage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const image = await productsService.addProductImage(
      req.user!.storeId,
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, image, 'Image added successfully', 201);
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /admin/products/:id/images/:imageId ───────────────────────────────

export const deleteProductImage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await productsService.deleteProductImage(
      req.user!.storeId,
      req.params.id as string,
      req.params.imageId as string,
    );
    sendSuccess(res, null, 'Image deleted successfully');
  } catch (error) {
    next(error);
  }
};

// ─── POST /admin/products/:id/options ─────────────────────────────────────────

export const addProductOption = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const option = await productsService.addProductOption(
      req.user!.storeId,
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, option, 'Option added successfully', 201);
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /admin/products/:id/options/:optionId ─────────────────────────────

export const deleteProductOption = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await productsService.deleteProductOption(
      req.user!.storeId,
      req.params.id as string,
      req.params.optionId as string,
    );
    sendSuccess(res, null, 'Option deleted successfully');
  } catch (error) {
    next(error);
  }
};

// ─── POST /admin/products/:id/variants ────────────────────────────────────────

export const addProductVariant = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const variant = await productsService.addProductVariant(
      req.user!.storeId,
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, variant, 'Variant added successfully', 201);
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /admin/products/:id/variants/:variantId ────────────────────────────

export const updateProductVariant = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const variant = await productsService.updateProductVariant(
      req.user!.storeId,
      req.params.id as string,
      req.params.variantId as string,
      req.body,
    );
    sendSuccess(res, variant, 'Variant updated successfully');
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /admin/products/:id/variants/:variantId ───────────────────────────

export const deleteProductVariant = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await productsService.deleteProductVariant(
      req.user!.storeId,
      req.params.id as string,
      req.params.variantId as string,
    );
    sendSuccess(res, null, 'Variant deleted successfully');
  } catch (error) {
    next(error);
  }
};
