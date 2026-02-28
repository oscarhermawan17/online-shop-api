import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateProductInput {
  name: string;
  description?: string;
  basePrice: number;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  basePrice?: number;
}

export interface CreateProductImageInput {
  imageUrl: string;
}

export interface CreateProductOptionInput {
  name: string;
  values: string[];
}

export interface CreateVariantInput {
  sku?: string;
  priceOverride?: number;
  stock: number;
  optionValueIds: string[];
}

// ─── Product CRUD ─────────────────────────────────────────────────────────────

export const listProducts = async (storeId: string) => {
  return prisma.product.findMany({
    where: { storeId },
    include: {
      images: true,
      options: { include: { values: true } },
      variants: { include: { optionValues: { include: { optionValue: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getProduct = async (storeId: string, productId: string) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId },
    include: {
      images: true,
      options: { include: { values: true } },
      variants: { include: { optionValues: { include: { optionValue: true } } } },
    },
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  return product;
};

export const createProduct = async (storeId: string, data: CreateProductInput) => {
  return prisma.product.create({
    data: {
      storeId,
      name: data.name,
      description: data.description,
      basePrice: data.basePrice,
    },
    include: {
      images: true,
      options: { include: { values: true } },
      variants: true,
    },
  });
};

export const updateProduct = async (
  storeId: string,
  productId: string,
  data: UpdateProductInput,
) => {
  // Ensure product belongs to store
  await getProduct(storeId, productId);

  return prisma.product.update({
    where: { id: productId },
    data,
    include: {
      images: true,
      options: { include: { values: true } },
      variants: { include: { optionValues: { include: { optionValue: true } } } },
    },
  });
};

export const deleteProduct = async (storeId: string, productId: string) => {
  // Ensure product belongs to store
  await getProduct(storeId, productId);

  await prisma.product.delete({
    where: { id: productId },
  });
};

// ─── Product Images ───────────────────────────────────────────────────────────

export const addProductImage = async (
  storeId: string,
  productId: string,
  data: CreateProductImageInput,
) => {
  // Ensure product belongs to store
  await getProduct(storeId, productId);

  return prisma.productImage.create({
    data: {
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
  // Ensure product belongs to store
  await getProduct(storeId, productId);

  const image = await prisma.productImage.findFirst({
    where: { id: imageId, productId },
  });

  if (!image) {
    throw new AppError('Image not found', 404);
  }

  await prisma.productImage.delete({
    where: { id: imageId },
  });
};

// ─── Product Options ──────────────────────────────────────────────────────────

export const addProductOption = async (
  storeId: string,
  productId: string,
  data: CreateProductOptionInput,
) => {
  // Ensure product belongs to store
  await getProduct(storeId, productId);

  return prisma.productOption.create({
    data: {
      productId,
      name: data.name,
      values: {
        createMany: {
          data: data.values.map((value) => ({ value })),
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
  // Ensure product belongs to store
  await getProduct(storeId, productId);

  const option = await prisma.productOption.findFirst({
    where: { id: optionId, productId },
  });

  if (!option) {
    throw new AppError('Option not found', 404);
  }

  await prisma.productOption.delete({
    where: { id: optionId },
  });
};

// ─── Product Variants ─────────────────────────────────────────────────────────

export const addProductVariant = async (
  storeId: string,
  productId: string,
  data: CreateVariantInput,
) => {
  // Ensure product belongs to store
  await getProduct(storeId, productId);

  return prisma.variant.create({
    data: {
      productId,
      sku: data.sku,
      priceOverride: data.priceOverride,
      stock: data.stock,
      optionValues: {
        createMany: {
          data: data.optionValueIds.map((optionValueId) => ({ optionValueId })),
        },
      },
    },
    include: { optionValues: { include: { optionValue: true } } },
  });
};

export const updateProductVariant = async (
  storeId: string,
  productId: string,
  variantId: string,
  data: { sku?: string; priceOverride?: number | null; stock?: number },
) => {
  // Ensure product belongs to store
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
  // Ensure product belongs to store
  await getProduct(storeId, productId);

  const variant = await prisma.variant.findFirst({
    where: { id: variantId, productId },
  });

  if (!variant) {
    throw new AppError('Variant not found', 404);
  }

  await prisma.variant.delete({
    where: { id: variantId },
  });
};
