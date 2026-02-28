import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductWithRelations = NonNullable<Awaited<ReturnType<typeof getProductById>>>;
type VariantWithOptions = ProductWithRelations['variants'][number];
type VariantOptionValue = VariantWithOptions['optionValues'][number];

// ─── Helper: Format product for public API ────────────────────────────────────

const formatProductForPublic = (product: ProductWithRelations) => {
  return {
    ...product,
    variants: product.variants.map((variant: VariantWithOptions) => ({
      id: variant.id,
      sku: variant.sku,
      stock: variant.stock,
      price: variant.priceOverride ?? product.basePrice,
      options: variant.optionValues.map((ov: VariantOptionValue) => ({
        optionId: ov.optionValue.optionId,
        optionValueId: ov.optionValueId,
        value: ov.optionValue.value,
      })),
    })),
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

export const listProducts = async (storeId?: string) => {
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

  return products.map(formatProductForPublic);
};

export const getProduct = async (productId: string) => {
  const product = await getProductById(productId);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  return formatProductForPublic(product);
};
