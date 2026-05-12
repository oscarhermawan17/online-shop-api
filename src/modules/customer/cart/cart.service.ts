import prisma from "../../../config/prisma"

export interface CartItemInput {
  productId: string
  variantId: string
  quantity: number
}

// ─── Get all cart items ─────────────────────────────────────────────────────

export const getCart = (customerId: string, storeId: string) => {
  return prisma.cartItem.findMany({
    where: { customerId, storeId },
    select: {
      productId: true,
      variantId: true,
      quantity: true,
    },
    orderBy: { createdAt: "asc" },
  })
}

// ─── Add or increment a cart item ───────────────────────────────────────────

export const addItem = async (
  customerId: string,
  storeId: string,
  input: CartItemInput,
) => {
  const variant = await prisma.variant.findFirst({
    where: { id: input.variantId, productId: input.productId, storeId },
  })

  if (!variant) {
    throw new Error("Variant not found")
  }

  const existing = await prisma.cartItem.findUnique({
    where: {
      customerId_productId_variantId: {
        customerId,
        productId: input.productId,
        variantId: input.variantId,
      },
    },
  })

  const newQuantity = Math.min(
    (existing?.quantity ?? 0) + input.quantity,
    variant.stock,
  )

  if (newQuantity <= 0) {
    return null
  }

  return prisma.cartItem.upsert({
    where: {
      customerId_productId_variantId: {
        customerId,
        productId: input.productId,
        variantId: input.variantId,
      },
    },
    create: {
      customerId,
      storeId,
      productId: input.productId,
      variantId: input.variantId,
      quantity: newQuantity,
    },
    update: {
      quantity: newQuantity,
    },
    select: {
      productId: true,
      variantId: true,
      quantity: true,
    },
  })
}

// ─── Set quantity for a cart item ────────────────────────────────────────────

export const setQuantity = async (
  customerId: string,
  storeId: string,
  productId: string,
  variantId: string,
  quantity: number,
) => {
  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({
      where: { customerId, productId, variantId },
    })
    return null
  }

  const variant = await prisma.variant.findFirst({
    where: { id: variantId, productId, storeId },
  })

  const clampedQuantity = variant ? Math.min(quantity, variant.stock) : quantity

  return prisma.cartItem.upsert({
    where: {
      customerId_productId_variantId: { customerId, productId, variantId },
    },
    create: {
      customerId,
      storeId,
      productId,
      variantId,
      quantity: clampedQuantity,
    },
    update: {
      quantity: clampedQuantity,
    },
    select: {
      productId: true,
      variantId: true,
      quantity: true,
    },
  })
}

// ─── Remove a cart item ─────────────────────────────────────────────────────

export const removeItem = async (
  customerId: string,
  productId: string,
  variantId: string,
) => {
  await prisma.cartItem.deleteMany({
    where: { customerId, productId, variantId },
  })
}

// ─── Clear entire cart ──────────────────────────────────────────────────────

export const clearCart = async (customerId: string, storeId: string) => {
  await prisma.cartItem.deleteMany({
    where: { customerId, storeId },
  })
}

// ─── Merge guest cart into server cart ───────────────────────────────────────

export const mergeCart = async (
  customerId: string,
  storeId: string,
  items: CartItemInput[],
) => {
  for (const item of items) {
    const variant = await prisma.variant.findFirst({
      where: { id: item.variantId, productId: item.productId, storeId },
    })

    if (!variant || variant.stock <= 0) continue

    const existing = await prisma.cartItem.findUnique({
      where: {
        customerId_productId_variantId: {
          customerId,
          productId: item.productId,
          variantId: item.variantId,
        },
      },
    })

    const summedQuantity = (existing?.quantity ?? 0) + item.quantity
    const clampedQuantity = Math.min(summedQuantity, variant.stock)

    if (clampedQuantity <= 0) continue

    await prisma.cartItem.upsert({
      where: {
        customerId_productId_variantId: {
          customerId,
          productId: item.productId,
          variantId: item.variantId,
        },
      },
      create: {
        customerId,
        storeId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: clampedQuantity,
      },
      update: {
        quantity: clampedQuantity,
      },
    })
  }

  return getCart(customerId, storeId)
}
