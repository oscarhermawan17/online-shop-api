import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductWithRelations = NonNullable<Awaited<ReturnType<typeof getProductById>>>;
type VariantWithOptions = ProductWithRelations['variants'][number];
type VariantOptionValue = VariantWithOptions['optionValues'][number];

// ─── Helper: Apply discount to a price ───────────────────────────────────────

const applyDiscount = (price: number, discountPercent: number | null | undefined): number => {
  if (!discountPercent) return price;
  return Math.round(price * (1 - discountPercent / 100));
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

export const listProducts = async (storeId?: string, isWholesale: boolean = false) => {
  const products = await prisma.product.findMany({
    where: storeId ? { storeId } : undefined,
    include: {
      store: {
        select: {
          id: true,
          name: true,
          whatsappNumber: true,
        },
      },
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

export const getProduct = async (productId: string, isWholesale: boolean = false) => {
  const product = await getProductById(productId);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  return formatProductForPublic(product, isWholesale);
};
