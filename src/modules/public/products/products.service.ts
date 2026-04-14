import { Prisma } from '@prisma/client';

import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductWithRelations = NonNullable<Awaited<ReturnType<typeof getProductById>>>;
type VariantWithOptions = ProductWithRelations['variants'][number];
type VariantOptionValue = VariantWithOptions['optionValues'][number];
type ProductSuggestionType = 'product' | 'category' | 'unit';

export interface ProductSearchSuggestion {
  value: string;
  type: ProductSuggestionType;
}

// ─── Helper: Apply discount to a price ───────────────────────────────────────

const applyDiscount = (price: number, discountPercent: number | null | undefined): number => {
  if (!discountPercent) return price;
  return Math.round(price * (1 - discountPercent / 100));
};

const buildProductSearchWhere = (storeId?: string, query?: string): Prisma.ProductWhereInput => {
  const normalizedQuery = query?.trim();

  return {
    ...(storeId ? { storeId } : {}),
    ...(normalizedQuery
      ? {
          OR: [
            {
              name: {
                contains: normalizedQuery,
                mode: 'insensitive',
              },
            },
            {
              description: {
                contains: normalizedQuery,
                mode: 'insensitive',
              },
            },
            {
              unit: {
                is: {
                  name: {
                    contains: normalizedQuery,
                    mode: 'insensitive',
                  },
                },
              },
            },
            {
              categories: {
                some: {
                  name: {
                    contains: normalizedQuery,
                    mode: 'insensitive',
                  },
                },
              },
            },
          ],
        }
      : {}),
  };
};

// ─── Helper: Format product for public API ────────────────────────────────────

const formatProductForPublic = (product: ProductWithRelations, isWholesale: boolean) => {
  const discount = product.discount;

  const rawBasePrice = isWholesale
    ? (product.wholesalePrice ?? product.basePrice)
    : product.basePrice;

  const effectiveBasePrice = isWholesale
    ? (discount?.retailDiscountActive ? applyDiscount(rawBasePrice, discount.retailDiscount) : rawBasePrice)
    : (discount?.normalDiscountActive ? applyDiscount(rawBasePrice, discount.normalDiscount) : rawBasePrice);

  return {
    ...product,
    basePrice: effectiveBasePrice,
    discount: discount ?? null,
    variants: product.variants.map((variant: VariantWithOptions) => {
      const retailPrice = variant.priceOverride ?? product.basePrice;
      const wholesalePrice = variant.wholesalePriceOverride ?? product.wholesalePrice ?? retailPrice;
      const rawPrice = isWholesale ? wholesalePrice : retailPrice;

      const price = isWholesale
        ? (discount?.retailDiscountActive ? applyDiscount(rawPrice, discount.retailDiscount) : rawPrice)
        : (discount?.normalDiscountActive ? applyDiscount(rawPrice, discount.normalDiscount) : rawPrice);

      return {
        id: variant.id,
        stock: variant.stock,
        price,
        options: variant.optionValues.map((ov: VariantOptionValue) => ({
          optionId: ov.optionValue.optionId,
          optionValueId: ov.optionValueId,
          value: ov.optionValue.value,
        })),
      };
    }),
  };
};

// ─── Service ──────────────────────────────────────────────────────────────────

const getProductById = (productId: string) => {
  return prisma.product.findUnique({
    where: { id: productId },
    include: {
      store: {
        select: {
          id: true,
          name: true,
          whatsappNumber: true,
        },
      },
      categories: true,
      unit: true,
      images: true,
      options: { include: { values: true } },
      variants: {
        include: {
          optionValues: {
            include: {
              optionValue: true,
            },
          },
        },
      },
      discount: true,
    },
  });
};

export const listProducts = async (
  storeId?: string,
  query?: string,
  isWholesale: boolean = false,
) => {
  const products = await prisma.product.findMany({
    where: buildProductSearchWhere(storeId, query),
    include: {
      store: {
        select: {
          id: true,
          name: true,
          whatsappNumber: true,
        },
      },
      categories: true,
      unit: true,
      images: true,
      options: { include: { values: true } },
      variants: {
        include: {
          optionValues: {
            include: {
              optionValue: true,
            },
          },
        },
      },
      discount: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return products.map((p) => formatProductForPublic(p, isWholesale));
};

export const listProductSuggestions = async (
  storeId?: string,
  query?: string,
): Promise<ProductSearchSuggestion[]> => {
  const normalizedQuery = query?.trim();

  if (!normalizedQuery) {
    return [];
  }

  const queryLower = normalizedQuery.toLowerCase();
  const products = await prisma.product.findMany({
    where: buildProductSearchWhere(storeId, normalizedQuery),
    select: {
      name: true,
      categories: {
        select: {
          name: true,
        },
      },
      unit: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });

  const suggestions: ProductSearchSuggestion[] = [];
  const seen = new Set<string>();
  const addSuggestion = (value: string | null | undefined, type: ProductSuggestionType) => {
    const normalizedValue = value?.trim();

    if (!normalizedValue) {
      return;
    }

    const valueLower = normalizedValue.toLowerCase();

    if (!valueLower.includes(queryLower) || seen.has(valueLower)) {
      return;
    }

    seen.add(valueLower);
    suggestions.push({ value: normalizedValue, type });
  };

  for (const product of products) {
    addSuggestion(product.name, 'product');
  }

  for (const product of products) {
    for (const category of product.categories) {
      addSuggestion(category.name, 'category');
    }
  }

  for (const product of products) {
    addSuggestion(product.unit?.name, 'unit');
  }

  return suggestions.slice(0, 8);
};

export const getProduct = async (productId: string, isWholesale: boolean = false) => {
  const product = await getProductById(productId);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  return formatProductForPublic(product, isWholesale);
};
