import { Prisma } from '@prisma/client';

import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';
import { resolveVariantDiscount } from '../../../utils/variant-discount';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductWithRelations = NonNullable<Awaited<ReturnType<typeof getProductById>>>;
type VariantWithOptions = ProductWithRelations['variants'][number];
type VariantOptionValue = VariantWithOptions['optionValues'][number];
type ProductSuggestionType = 'product' | 'category' | 'unit';

export interface ListProductsInput {
  storeId?: string;
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  promoOnly?: boolean;
  page?: number;
  limit?: number;
  isWholesale?: boolean;
}

export interface ProductSearchSuggestion {
  value: string;
  type: ProductSuggestionType;
}


const getSellableVariants = (variants: ProductWithRelations['variants']) => {
  const realVariants = variants.filter((variant) => !variant.isDefault);
  return realVariants.length > 0 ? realVariants : variants;
};

const buildProductSearchWhere = (
  storeId?: string,
  query?: string,
  category?: string,
): Prisma.ProductWhereInput => {
  const normalizedQuery = query?.trim();
  const normalizedCategory = category?.trim();

  return {
    ...(storeId ? { storeId } : {}),
    isActive: true,
    ...(normalizedCategory
      ? {
          categories: {
            some: {
              name: {
                equals: normalizedCategory,
                mode: 'insensitive',
              },
            },
          },
        }
      : {}),
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

const getProductPriceRange = (product: ReturnType<typeof formatProductForPublic>) => {
  const variantPrices = product.variants
    .map((variant) => variant.price ?? product.basePrice)
    .filter((price): price is number => typeof price === 'number');

  const allPrices = variantPrices.length > 0
    ? [product.basePrice, ...variantPrices]
    : [product.basePrice];

  return {
    minPrice: Math.min(...allPrices),
    maxPrice: Math.max(...allPrices),
  };
};

const normalizePriceRange = (
  minPrice?: number,
  maxPrice?: number,
) => {
  const normalizedMinPrice = Number.isFinite(minPrice) && Number(minPrice) >= 0
    ? Number(minPrice)
    : null;
  const normalizedMaxPrice = Number.isFinite(maxPrice) && Number(maxPrice) >= 0
    ? Number(maxPrice)
    : null;

  if (
    normalizedMinPrice !== null
    && normalizedMaxPrice !== null
    && normalizedMinPrice > normalizedMaxPrice
  ) {
    return {
      minPrice: normalizedMaxPrice,
      maxPrice: normalizedMinPrice,
    };
  }

  return {
    minPrice: normalizedMinPrice,
    maxPrice: normalizedMaxPrice,
  };
};

const matchesPriceRange = (
  product: ReturnType<typeof formatProductForPublic>,
  minPrice: number | null,
  maxPrice: number | null,
) => {
  const priceRange = getProductPriceRange(product);

  if (minPrice !== null && priceRange.maxPrice < minPrice) {
    return false;
  }

  if (maxPrice !== null && priceRange.minPrice > maxPrice) {
    return false;
  }

  return true;
};

const matchesPromoOnly = (
  product: ReturnType<typeof formatProductForPublic>,
  promoOnly: boolean,
) => {
  if (!promoOnly) {
    return true;
  }

  return product.hasVariantPromo;
};

// ─── Helper: Format product for public API ────────────────────────────────────

const formatProductForPublic = (product: ProductWithRelations, isWholesale: boolean) => {
  const customerType = isWholesale ? 'wholesale' : 'base';
  const sellableVariants = getSellableVariants(product.variants);

  const rawBasePrice = isWholesale
    ? (product.wholesalePrice ?? product.basePrice)
    : product.basePrice;

  const resolvedVariants = sellableVariants.map((variant: VariantWithOptions) => {
    const retailPrice = variant.priceOverride ?? product.basePrice;
    const wholesalePrice = variant.wholesalePriceOverride ?? product.wholesalePrice ?? retailPrice;
    const rawPrice = isWholesale ? wholesalePrice : retailPrice;

    const pricing = resolveVariantDiscount(variant.discountRules, {
      quantity: 1,
      unitPrice: rawPrice,
      customerType,
    });

    return {
      id: variant.id,
      name: variant.name,
      imageUrl: variant.imageUrl,
      stock: variant.stock,
      price: pricing.effectiveUnitPrice,
      activeDiscountRuleId: pricing.rule?.id ?? null,
      discountRules: variant.discountRules,
      options: variant.optionValues.map((ov: VariantOptionValue) => ({
        optionId: ov.optionValue.optionId,
        optionValueId: ov.optionValueId,
        value: ov.optionValue.value,
      })),
    };
  });

  const effectiveBasePrice = resolvedVariants.length > 0
    ? Math.min(...resolvedVariants.map((variant) => variant.price))
    : rawBasePrice;

  return {
    ...product,
    basePrice: effectiveBasePrice,
    // Keep legacy field for compatibility but stop using product-level discount.
    discount: null,
    hasVariantPromo: sellableVariants.some((variant) => variant.discountRules.length > 0),
    stock: sellableVariants.reduce((sum, variant) => sum + variant.stock, 0),
    variants: resolvedVariants,
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
          discountRules: {
            where: { isActive: true },
            orderBy: [
              { priority: 'desc' },
              { minThreshold: 'desc' },
              { createdAt: 'asc' },
            ],
          },
        },
      },
      discount: true,
    },
  });
};

export const listProducts = async ({
  storeId,
  query,
  category,
  minPrice,
  maxPrice,
  promoOnly = false,
  page = 1,
  limit = 10,
  isWholesale = false,
}: ListProductsInput) => {
  const products = await prisma.product.findMany({
    where: buildProductSearchWhere(storeId, query, category),
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
          discountRules: {
            where: { isActive: true },
            orderBy: [
              { priority: 'desc' },
              { minThreshold: 'desc' },
              { createdAt: 'asc' },
            ],
          },
        },
      },
      discount: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const normalizedPage = Number.isInteger(page) && page > 0 ? page : 1;
  const normalizedLimit = Number.isInteger(limit) && limit > 0
    ? Math.min(limit, 50)
    : 10;
  const normalizedPriceRange = normalizePriceRange(minPrice, maxPrice);
  const filteredProducts = products
    .map((product) => formatProductForPublic(product, isWholesale))
    .filter((product) => matchesPromoOnly(product, promoOnly))
    .filter((product) => (
      matchesPriceRange(
        product,
        normalizedPriceRange.minPrice,
        normalizedPriceRange.maxPrice,
      )
    ));

  const total = filteredProducts.length;
  const totalPages = total > 0 ? Math.ceil(total / normalizedLimit) : 1;
  const currentPage = Math.min(normalizedPage, totalPages);
  const startIndex = (currentPage - 1) * normalizedLimit;
  const data = filteredProducts.slice(startIndex, startIndex + normalizedLimit);

  return {
    data,
    pagination: {
      page: currentPage,
      limit: normalizedLimit,
      total,
      totalPages,
    },
  };
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
