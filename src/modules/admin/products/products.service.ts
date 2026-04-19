import {
  CustomerType,
  DiscountApplyMode,
  DiscountTriggerType,
  DiscountValueType,
} from '@prisma/client';

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
  imageUrl?: string | null;
  priceOverride?: number;
  wholesalePriceOverride?: number;
  stock: number;
  optionValueIds?: string[];
}

export interface CreateProductVariantInput {
  name?: string;
  imageUrl?: string | null;
  basePrice: number;
  wholesalePrice?: number | null;
  stock: number;
}

export interface CreateVariantDiscountRuleInput {
  name?: string | null;
  triggerType: DiscountTriggerType;
  minThreshold: number;
  maxThreshold?: number | null;
  valueType: DiscountValueType;
  value: number;
  applyMode: DiscountApplyMode;
  customerType?: CustomerType | null;
  isActive?: boolean;
  priority?: number;
}

export interface UpdateVariantDiscountRuleInput {
  name?: string | null;
  triggerType?: DiscountTriggerType;
  minThreshold?: number;
  maxThreshold?: number | null;
  valueType?: DiscountValueType;
  value?: number;
  applyMode?: DiscountApplyMode;
  customerType?: CustomerType | null;
  isActive?: boolean;
  priority?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const variantInclude = {
  optionValues: { include: { optionValue: true } },
  discountRules: {
    orderBy: [
      { priority: 'desc' as const },
      { minThreshold: 'desc' as const },
      { createdAt: 'asc' as const },
    ],
  },
};

const productInclude = {
  categories: true,
  unit: true,
  images: { orderBy: { createdAt: 'asc' as const } },
  options: { include: { values: true } },
  variants: { include: variantInclude },
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

const assertVariantOwnership = async (
  storeId: string,
  productId: string,
  variantId: string,
) => {
  const variant = await prisma.variant.findFirst({
    where: {
      id: variantId,
      productId,
      storeId,
    },
  });

  if (!variant) {
    throw new AppError('Variant not found', 404);
  }

  return variant;
};

const normalizeRuleInput = (
  input: CreateVariantDiscountRuleInput | UpdateVariantDiscountRuleInput,
) => {
  const normalized: UpdateVariantDiscountRuleInput = {
    ...input,
  };

  if (Object.prototype.hasOwnProperty.call(input, 'name')) {
    normalized.name = input.name?.trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'maxThreshold')) {
    normalized.maxThreshold = input.maxThreshold ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'customerType')) {
    normalized.customerType = input.customerType ?? null;
  }

  return normalized;
};

const validateRuleInput = (
  input: UpdateVariantDiscountRuleInput,
  isPartial: boolean,
) => {
  const requiredFields: Array<keyof CreateVariantDiscountRuleInput> = [
    'triggerType',
    'minThreshold',
    'valueType',
    'value',
    'applyMode',
  ];

  if (!isPartial) {
    for (const field of requiredFields) {
      if (input[field] === undefined) {
        throw new AppError(`Field ${field} is required`, 400);
      }
    }
  }

  if (input.triggerType !== undefined) {
    const validTrigger = input.triggerType === 'quantity' || input.triggerType === 'line_subtotal';
    if (!validTrigger) {
      throw new AppError('Invalid triggerType', 400);
    }
  }

  if (input.minThreshold !== undefined) {
    if (!Number.isInteger(input.minThreshold) || input.minThreshold < 1) {
      throw new AppError('minThreshold must be an integer >= 1', 400);
    }
  }

  if (input.maxThreshold !== undefined && input.maxThreshold !== null) {
    if (!Number.isInteger(input.maxThreshold) || input.maxThreshold < 1) {
      throw new AppError('maxThreshold must be an integer >= 1', 400);
    }
  }

  if (
    input.minThreshold !== undefined
    && input.maxThreshold !== undefined
    && input.maxThreshold !== null
    && input.maxThreshold < input.minThreshold
  ) {
    throw new AppError('maxThreshold must be greater than or equal to minThreshold', 400);
  }

  if (input.valueType !== undefined) {
    const validValueType = input.valueType === 'percentage' || input.valueType === 'fixed_amount';
    if (!validValueType) {
      throw new AppError('Invalid valueType', 400);
    }
  }

  if (input.value !== undefined) {
    if (!Number.isInteger(input.value) || input.value <= 0) {
      throw new AppError('value must be an integer > 0', 400);
    }
  }

  if (
    input.valueType === 'percentage'
    && input.value !== undefined
    && (input.value < 1 || input.value > 100)
  ) {
    throw new AppError('Percentage value must be between 1 and 100', 400);
  }

  if (input.applyMode !== undefined) {
    const validApplyMode = input.applyMode === 'per_item' || input.applyMode === 'line_total';
    if (!validApplyMode) {
      throw new AppError('Invalid applyMode', 400);
    }
  }

  if (
    input.customerType !== undefined
    && input.customerType !== null
    && input.customerType !== 'base'
    && input.customerType !== 'wholesale'
  ) {
    throw new AppError('Invalid customerType', 400);
  }

  if (input.priority !== undefined && !Number.isInteger(input.priority)) {
    throw new AppError('priority must be an integer', 400);
  }
};

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
    imageUrl: variant.imageUrl ?? null,
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
            imageUrl: variant.imageUrl,
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
      imageUrl: data.imageUrl ?? null,
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
    include: variantInclude,
  });
};

export const updateProductVariant = async (
  storeId: string,
  productId: string,
  variantId: string,
  data: {
    name?: string;
    imageUrl?: string | null;
    priceOverride?: number | null;
    wholesalePriceOverride?: number | null;
    stock?: number;
  },
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
    include: variantInclude,
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

// ─── Variant Discount Rules ───────────────────────────────────────────────────

export const listVariantDiscountRules = async (
  storeId: string,
  productId: string,
  variantId: string,
) => {
  await assertVariantOwnership(storeId, productId, variantId);

  return prisma.variantDiscountRule.findMany({
    where: {
      storeId,
      variantId,
    },
    orderBy: [
      { isActive: 'desc' },
      { priority: 'desc' },
      { minThreshold: 'desc' },
      { createdAt: 'asc' },
    ],
  });
};

export const createVariantDiscountRule = async (
  storeId: string,
  productId: string,
  variantId: string,
  data: CreateVariantDiscountRuleInput,
) => {
  await assertVariantOwnership(storeId, productId, variantId);

  const normalized = normalizeRuleInput(data);
  validateRuleInput(normalized, false);

  return prisma.variantDiscountRule.create({
    data: {
      storeId,
      variantId,
      name: normalized.name ?? null,
      triggerType: normalized.triggerType!,
      minThreshold: normalized.minThreshold!,
      maxThreshold: normalized.maxThreshold ?? null,
      valueType: normalized.valueType!,
      value: normalized.value!,
      applyMode: normalized.applyMode!,
      customerType: normalized.customerType ?? null,
      isActive: normalized.isActive ?? true,
      priority: normalized.priority ?? 0,
    },
  });
};

export const updateVariantDiscountRule = async (
  storeId: string,
  productId: string,
  variantId: string,
  ruleId: string,
  data: UpdateVariantDiscountRuleInput,
) => {
  await assertVariantOwnership(storeId, productId, variantId);

  const existing = await prisma.variantDiscountRule.findFirst({
    where: {
      id: ruleId,
      storeId,
      variantId,
    },
  });

  if (!existing) {
    throw new AppError('Variant discount rule not found', 404);
  }

  const normalized = normalizeRuleInput(data);

  const merged: UpdateVariantDiscountRuleInput = {
    name: normalized.name ?? existing.name,
    triggerType: normalized.triggerType ?? existing.triggerType,
    minThreshold: normalized.minThreshold ?? existing.minThreshold,
    maxThreshold: normalized.maxThreshold ?? existing.maxThreshold,
    valueType: normalized.valueType ?? existing.valueType,
    value: normalized.value ?? existing.value,
    applyMode: normalized.applyMode ?? existing.applyMode,
    customerType: normalized.customerType ?? existing.customerType,
    isActive: normalized.isActive ?? existing.isActive,
    priority: normalized.priority ?? existing.priority,
  };

  validateRuleInput(merged, false);

  return prisma.variantDiscountRule.update({
    where: { id: existing.id },
    data: {
      name: normalized.name !== undefined ? normalized.name : undefined,
      triggerType: normalized.triggerType,
      minThreshold: normalized.minThreshold,
      maxThreshold: normalized.maxThreshold,
      valueType: normalized.valueType,
      value: normalized.value,
      applyMode: normalized.applyMode,
      customerType: normalized.customerType,
      isActive: normalized.isActive,
      priority: normalized.priority,
    },
  });
};

export const deleteVariantDiscountRule = async (
  storeId: string,
  productId: string,
  variantId: string,
  ruleId: string,
) => {
  await assertVariantOwnership(storeId, productId, variantId);

  const existing = await prisma.variantDiscountRule.findFirst({
    where: {
      id: ruleId,
      storeId,
      variantId,
    },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError('Variant discount rule not found', 404);
  }

  await prisma.variantDiscountRule.delete({
    where: { id: existing.id },
  });
};

// ─── Product Discount (legacy) ───────────────────────────────────────────────

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
