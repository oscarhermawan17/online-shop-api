import { Response, NextFunction } from 'express';

import prisma from '../../../config/prisma';
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

const parseStringArrayQuery = (value: unknown) => {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set<string>();

  return values
    .filter((item): item is string => typeof item === 'string')
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) {
        return false;
      }

      const normalizedItem = item.toLowerCase();
      if (seen.has(normalizedItem)) {
        return false;
      }

      seen.add(normalizedItem);
      return true;
    });
};

const resolveIsWholesaleCustomer = async (req: CustomerAuthRequest): Promise<boolean> => {
  if (!req.customer?.customerId) {
    return false;
  }

  const customer = await prisma.customer.findUnique({
    where: { id: req.customer.customerId },
    select: {
      type: true,
      isActive: true,
      storeId: true,
    },
  });

  return !!customer
    && customer.isActive
    && customer.storeId === req.customer.storeId
    && customer.type === 'wholesale';
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
    const category = parseStringArrayQuery(req.query.category);
    const page = parseOptionalNumberQuery(req.query.page);
    const limit = parseOptionalNumberQuery(req.query.limit);
    const minPrice = parseOptionalNumberQuery(req.query.minPrice);
    const maxPrice = parseOptionalNumberQuery(req.query.maxPrice);
    const promoOnly = parseBooleanQuery(req.query.promoOnly);
    const isWholesale = await resolveIsWholesaleCustomer(req);
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
    const isWholesale = await resolveIsWholesaleCustomer(req);
    const product = await productsService.getProduct(req.params.id as string, isWholesale);
    sendSuccess(res, product, 'Product fetched successfully');
  } catch (error) {
    next(error);
  }
};
