import { Request, Response, NextFunction } from 'express';

import { sendSuccess } from '../../../utils/response';
import * as productsService from './products.service';

// ─── GET /products ────────────────────────────────────────────────────────────

export const listProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.query.storeId as string | undefined;
    const products = await productsService.listProducts(storeId);
    sendSuccess(res, products, 'Products fetched successfully');
  } catch (error) {
    next(error);
  }
};

// ─── GET /products/:id ────────────────────────────────────────────────────────

export const getProduct = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const product = await productsService.getProduct(req.params.id as string);
    sendSuccess(res, product, 'Product fetched successfully');
  } catch (error) {
    next(error);
  }
};
