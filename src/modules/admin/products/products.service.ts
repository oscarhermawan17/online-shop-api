import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateProductInput {
  name: string;
  description?: string;
  categoryIds?: string[];
  unitId?: string | null;
  basePrice?: number;
  wholesalePrice?: number | null;
  stock?: number;
  variants?: CreateProductVariantInput[];
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  categoryIds?: string[];
  unitId?: string | null;
  basePrice?: number;
  wholesalePrice?: number | null;
  isActive?: boolean;
  stock?: number;
}

export interface CreateProductImageInput {
  imageUrl: string;
}

export interface CreateProductOptionInput {
  name: string;
  values: string[];
}

export interface CreateVariantInput {
  name?: string;
  priceOverride?: number;
  wholesalePriceOverride?: number;
  stock: number;
  optionValueIds?: string[];
}

export interface CreateProductVariantInput {
  name?: string;
  basePrice: number;
  wholesalePrice?: number | null;
  stock: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const productInclude = {
  categories: true,
  unit: true,
  images: true,
  options: { include: { values: true } },
  variants: { include: { optionValues: { include: { optionValue: true } } } },
  discount: true,
};

function getSellableVariants<T extends { isDefault: boolean }>(variants: T[]): T[] {
  const realVariants = variants.filter((variant) => !variant.isDefault);
  return realVariants.length > 0 ? realVariants : variants;
}

function withStock<T extends { variants: Array<{ isDefault: boolean; stock: number }> }>(
  product: T,
): T & { stock: number } {
  const sellableVariants = getSellableVariants(product.variants);
  return {
    ...product,
    stock: sellableVariants.reduce((sum, variant) => sum + variant.stock, 0),
  };
}

// ─── Product CRUD ─────────────────────────────────────────────────────────────

export const listProducts = async (storeId: string) => {
  const products = await prisma.product.findMany({
    where: { storeId },
    include: productInclude,
    orderBy: { createdAt: 'desc' },
  });
  return products.map(withStock);
};

export const getProduct = async (storeId: string, productId: string) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId },
    include: productInclude,
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  return withStock(product);
};

export const createProduct = async (storeId: string, data: CreateProductInput) => {
  const normalizedVariants = data.variants?.map((variant) => ({
    name: variant.name?.trim() || null,
    basePrice: variant.basePrice,
    wholesalePrice: variant.wholesalePrice ?? null,
    stock: variant.stock,
  }));

  if (normalizedVariants?.length) {
    const [baseVariant] = normalizedVariants;
    const baselineWholesalePrice = baseVariant.wholesalePrice ?? baseVariant.basePrice;

    const product = await prisma.product.create({
      data: {
        storeId,
        name: data.name,
        description: data.description,
        categories: data.categoryIds ? { connect: data.categoryIds.map((id) => ({ id })) } : undefined,
        unitId: data.unitId ?? null,
        basePrice: baseVariant.basePrice,
        wholesalePrice:
          baselineWholesalePrice === baseVariant.basePrice ? null : baselineWholesalePrice,
        variants: {
          create: normalizedVariants.map((variant) => ({
            storeId,
            name: variant.name,
            isDefault: false,
            priceOverride:
              variant.basePrice === baseVariant.basePrice ? null : variant.basePrice,
            wholesalePriceOverride:
              (variant.wholesalePrice ?? variant.basePrice) === baselineWholesalePrice
                ? null
                : (variant.wholesalePrice ?? variant.basePrice),
            stock: variant.stock,
          })),
        },
      },
      include: productInclude,
    });

    return withStock(product);
  }

  if (data.basePrice === undefined || data.stock === undefined) {
    throw new AppError('basePrice and stock are required when variants are not provided', 400);
  }

  const product = await prisma.product.create({
    data: {
      storeId,
      name: data.name,
      description: data.description,
      categories: data.categoryIds ? { connect: data.categoryIds.map((id) => ({ id })) } : undefined,
      unitId: data.unitId ?? null,
      basePrice: data.basePrice,
      wholesalePrice: data.wholesalePrice,
      variants: {
        create: {
          storeId,
          isDefault: true,
          stock: data.stock,
        },
      },
    },
    include: productInclude,
  });
  return withStock(product);
};

export const updateProduct = async (
  storeId: string,
  productId: string,
  data: UpdateProductInput,
) => {
  await getProduct(storeId, productId);

  const { stock, categoryIds, ...productData } = data;

  await prisma.product.update({
    where: { id: productId },
    data: {
      ...productData,
      ...(categoryIds !== undefined
        ? { categories: { set: categoryIds.map((id) => ({ id })) } }
        : {}),
    },
  });

  if (stock !== undefined) {
    const defaultVariant = await prisma.variant.findFirst({
      where: { productId, isDefault: true },
    });

    if (defaultVariant) {
      await prisma.variant.update({
        where: { id: defaultVariant.id },
        data: { stock },
      });
    } else {
      await prisma.variant.create({
        data: { storeId, productId, isDefault: true, stock },
      });
    }
  }

  return getProduct(storeId, productId);
};

export const deleteProduct = async (storeId: string, productId: string) => {
  await getProduct(storeId, productId);
  await prisma.product.delete({ where: { id: productId } });
};

// ─── Product Images ───────────────────────────────────────────────────────────

export const addProductImage = async (
  storeId: string,
  productId: string,
  data: CreateProductImageInput,
) => {
  await getProduct(storeId, productId);

  return prisma.productImage.create({
    data: {
      storeId,
      productId,
      imageUrl: data.imageUrl,
    },
  });
};

export const deleteProductImage = async (
  storeId: string,
  productId: string,
  imageId: string,
) => {
  await getProduct(storeId, productId);

  const image = await prisma.productImage.findFirst({
    where: { id: imageId, productId },
  });

  if (!image) {
    throw new AppError('Image not found', 404);
  }

  await prisma.productImage.delete({ where: { id: imageId } });
};

// ─── Product Options ──────────────────────────────────────────────────────────

export const addProductOption = async (
  storeId: string,
  productId: string,
  data: CreateProductOptionInput,
) => {
  await getProduct(storeId, productId);

  return prisma.productOption.create({
    data: {
      storeId,
      productId,
      name: data.name,
      values: {
        createMany: {
          data: data.values.map((value) => ({ storeId, value })),
        },
      },
    },
    include: { values: true },
  });
};

export const deleteProductOption = async (
  storeId: string,
  productId: string,
  optionId: string,
) => {
  await getProduct(storeId, productId);

  const option = await prisma.productOption.findFirst({
    where: { id: optionId, productId },
  });

  if (!option) {
    throw new AppError('Option not found', 404);
  }

  await prisma.productOption.delete({ where: { id: optionId } });
};

// ─── Product Variants ─────────────────────────────────────────────────────────

export const addProductVariant = async (
  storeId: string,
  productId: string,
  data: CreateVariantInput,
) => {
  await getProduct(storeId, productId);

  return prisma.variant.create({
    data: {
      storeId,
      productId,
      name: data.name,
      priceOverride: data.priceOverride,
      wholesalePriceOverride: data.wholesalePriceOverride,
      stock: data.stock,
      isDefault: false,
      ...(data.optionValueIds?.length
        ? {
            optionValues: {
              createMany: {
                data: data.optionValueIds.map((optionValueId) => ({ optionValueId })),
              },
            },
          }
        : {}),
    },
    include: { optionValues: { include: { optionValue: true } } },
  });
};

export const updateProductVariant = async (
  storeId: string,
  productId: string,
  variantId: string,
  data: { name?: string; priceOverride?: number | null; wholesalePriceOverride?: number | null; stock?: number },
) => {
  await getProduct(storeId, productId);

  const variant = await prisma.variant.findFirst({
    where: { id: variantId, productId },
  });

  if (!variant) {
    throw new AppError('Variant not found', 404);
  }

  return prisma.variant.update({
    where: { id: variantId },
    data,
    include: { optionValues: { include: { optionValue: true } } },
  });
};

export const deleteProductVariant = async (
  storeId: string,
  productId: string,
  variantId: string,
) => {
  await getProduct(storeId, productId);

  const variantCount = await prisma.variant.count({
    where: { productId },
  });

  const variant = await prisma.variant.findFirst({
    where: { id: variantId, productId },
  });

  if (!variant) {
    throw new AppError('Variant not found', 404);
  }

  if (variant.isDefault) {
    throw new AppError('Cannot delete the default variant', 400);
  }

  if (variantCount <= 1) {
    throw new AppError('Product must have at least one variant', 400);
  }

  await prisma.variant.delete({ where: { id: variantId } });
};

// ─── Product Discount ─────────────────────────────────────────────────────────

export interface UpsertDiscountInput {
  normalDiscount?: number | null;
  normalDiscountActive?: boolean;
  retailDiscount?: number | null;
  retailDiscountActive?: boolean;
}

export const upsertDiscount = async (
  storeId: string,
  productId: string,
  data: UpsertDiscountInput,
) => {
  await getProduct(storeId, productId);

  return prisma.productDiscount.upsert({
    where: { productId },
    update: data,
    create: { storeId, productId, ...data },
  });
};
