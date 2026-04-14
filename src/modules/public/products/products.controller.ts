import { Response, NextFunction } from 'express';

import { CustomerAuthRequest } from '../../../middlewares/customer-auth.middleware';
import { sendPaginatedSuccess, sendSuccess } from '../../../utils/response';
import * as productsService from './products.service';

const parseOptionalNumberQuery = (value: unknown) => {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

const parseBooleanQuery = (value: unknown) => {
  if (typeof value !== 'string') {
    return false;
  }

  return value === 'true' || value === '1';
};

// ─── GET /products ────────────────────────────────────────────────────────────

export const listProducts = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.query.storeId as string | undefined;
    const query = req.query.q as string | undefined;
    const category = req.query.category as string | undefined;
    const page = parseOptionalNumberQuery(req.query.page);
    const limit = parseOptionalNumberQuery(req.query.limit);
    const minPrice = parseOptionalNumberQuery(req.query.minPrice);
    const maxPrice = parseOptionalNumberQuery(req.query.maxPrice);
    const promoOnly = parseBooleanQuery(req.query.promoOnly);
    const isWholesale = !!req.customer;
    const result = await productsService.listProducts({
      storeId,
      query,
      category,
      page,
      limit,
      minPrice,
      maxPrice,
      promoOnly,
      isWholesale,
    });
    sendPaginatedSuccess(
      res,
      result.data,
      result.pagination,
      'Products fetched successfully',
    );
  } catch (error) {
    next(error);
  }
};

// ─── GET /products/suggestions ────────────────────────────────────────────────

export const listProductSuggestions = async (
  req: CustomerAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const storeId = req.query.storeId as string | undefined;
    const query = req.query.q as string | undefined;
    const suggestions = await productsService.listProductSuggestions(storeId, query);
    sendSuccess(res, suggestions, 'Product suggestions fetched successfully');
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
