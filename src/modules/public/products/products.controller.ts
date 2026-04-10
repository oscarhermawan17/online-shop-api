import { Response, NextFunction } from 'express';

import { CustomerAuthRequest } from '../../../middlewares/customer-auth.middleware';
import { sendSuccess } from '../../../utils/response';
import * as productsService from './products.service';

// ─── GET /products ────────────────────────────────────────────────────────────

export const listProducts = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.query.storeId as string | undefined;
    const isWholesale = !!req.customer;
    const products = await productsService.listProducts(storeId, isWholesale);
    sendSuccess(res, products, 'Products fetched successfully');
  } catch (error) {
    next(error);
  }
};

// ─── GET /products/:id ────────────────────────────────────────────────────────

export const getProduct = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const isWholesale = !!req.customer;
    const product = await productsService.getProduct(req.params.id as string, isWholesale);
    sendSuccess(res, product, 'Product fetched successfully');
  } catch (error) {
    next(error);
  }
};
