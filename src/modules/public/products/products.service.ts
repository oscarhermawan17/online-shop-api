import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductWithRelations = NonNullable<Awaited<ReturnType<typeof getProductById>>>;
type VariantWithOptions = ProductWithRelations['variants'][number];
type VariantOptionValue = VariantWithOptions['optionValues'][number];

// ─── Helper: Format product for public API ────────────────────────────────────

const formatProductForPublic = (product: ProductWithRelations, isWholesale: boolean) => {
  const effectiveBasePrice = isWholesale
    ? (product.wholesalePrice ?? product.basePrice)
    : product.basePrice;

  return {
    ...product,
    basePrice: effectiveBasePrice,
    variants: product.variants.map((variant: VariantWithOptions) => {
      const retailPrice = variant.priceOverride ?? product.basePrice;
      const wholesalePrice = variant.wholesalePriceOverride ?? product.wholesalePrice ?? retailPrice;
      const price = isWholesale ? wholesalePrice : retailPrice;

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
