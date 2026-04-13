import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckoutItem {
  variantId?: string;
  productId: string;
  quantity: number;
}

export interface CheckoutInput {
  storeId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: string;
  deliveryMethod?: string;
  notes?: string;
  shippingCost?: number;
  items: CheckoutItem[];
  authenticatedCustomerId?: string;
}

export interface PaymentProofInput {
  imageUrl: string;
}

const formatRupiah = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

// ─── Helper: Generate public order ID ─────────────────────────────────────────

const generatePublicOrderId = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

// ─── Helper: Lazy expiry check ────────────────────────────────────────────────
// Fallback for orders that pg_cron hasn't processed yet.
// Restores stock and marks order as expired_unpaid.

const expireOrderIfNeeded = async (orderId: string): Promise<boolean> => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order || order.status !== 'pending_payment') return false;
  if (!order.expiresAt || order.expiresAt > new Date()) return false;

  // Restore stock for each item
  for (const item of order.items) {
    if (item.variantId) {
      await prisma.variant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }

  // Mark as expired
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'expired_unpaid' },
  });

  return true;
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const checkout = async (input: CheckoutInput) => {
  const {
    storeId, customerName, customerPhone, customerEmail,
    customerAddress, deliveryMethod, notes, shippingCost,
    items, authenticatedCustomerId,
  } = input;

  // Validate store exists
  const store = await prisma.store.findUnique({
    where: { id: storeId },
  });

  if (!store) {
    throw new AppError('Store not found', 404);
  }

  // Find or create customer — prefer authenticated customer when logged in
  let customer;
  if (authenticatedCustomerId) {
    customer = await prisma.customer.findUnique({
      where: { id: authenticatedCustomerId },
    });
    if (!customer) {
      throw new AppError('Authenticated customer not found', 404);
    }
  } else {
    customer = await prisma.customer.findUnique({
      where: { storeId_phone: { storeId, phone: customerPhone } },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          storeId,
          phone: customerPhone,
          email: customerEmail,
        },
      });
    } else if (customerEmail && !customer.email) {
      // Update email if provided and not set
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { email: customerEmail },
      });
    }
  }

  // Process items and calculate total
  let totalAmount = 0;
  const orderItems: {
    variantId: string | null;
    productName: string;
    variantDescription: string | null;
    price: number;
    quantity: number;
  }[] = [];

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: {
        discount: true,
        variants: {
          include: {
            optionValues: {
              include: { optionValue: { include: { option: true } } },
            },
          },
        },
      },
    });

    if (!product) {
      throw new AppError(`Product not found: ${item.productId}`, 404);
    }

    if (product.storeId !== storeId) {
      throw new AppError(`Product does not belong to this store`, 400);
    }

    const isWholesale = !!authenticatedCustomerId;
    const discount = product.discount;

    const applyDiscount = (p: number, pct: number | null | undefined) =>
      pct ? Math.round(p * (1 - pct / 100)) : p;

    let price = isWholesale
      ? applyDiscount(product.wholesalePrice ?? product.basePrice, discount?.retailDiscountActive ? discount.retailDiscount : null)
      : applyDiscount(product.basePrice, discount?.normalDiscountActive ? discount.normalDiscount : null);

    let variantDescription: string | null = null;

    if (item.variantId) {
      const variant = product.variants.find(
        (v: (typeof product.variants)[number]) => v.id === item.variantId,
      );
      if (!variant) {
        throw new AppError(`Variant not found: ${item.variantId}`, 404);
      }

      if (variant.stock < item.quantity) {
        throw new AppError(
          `Insufficient stock for variant: ${item.variantId}`,
          400,
        );
      }

      const retailPrice = variant.priceOverride ?? product.basePrice;
      const wholesalePrice = variant.wholesalePriceOverride ?? product.wholesalePrice ?? retailPrice;
      const rawPrice = isWholesale ? wholesalePrice : retailPrice;
      price = isWholesale
        ? applyDiscount(rawPrice, discount?.retailDiscountActive ? discount.retailDiscount : null)
        : applyDiscount(rawPrice, discount?.normalDiscountActive ? discount.normalDiscount : null);

      // Build variant description
      variantDescription = variant.optionValues
        .map(
          (ov: (typeof variant.optionValues)[number]) =>
            `${ov.optionValue.option.name}: ${ov.optionValue.value}`,
        )
        .join(', ');

      // Reduce stock
      await prisma.variant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    orderItems.push({
      variantId: item.variantId ?? null,
      productName: product.name,
      variantDescription,
      price,
      quantity: item.quantity,
    });

    totalAmount += price * item.quantity;
  }

  const isDelivery = deliveryMethod === 'delivery';
  const isStoreCustomer = !!authenticatedCustomerId;
  const minimumOrder = isStoreCustomer
    ? store.deliveryStoreMinimumOrder
    : store.deliveryRetailMinimumOrder;
  const freeShippingMinimumOrder = isStoreCustomer
    ? store.deliveryStoreFreeShippingMinimumOrder
    : store.deliveryRetailFreeShippingMinimumOrder;

  if (isDelivery && minimumOrder && totalAmount < minimumOrder) {
    throw new AppError(
      `Minimal belanja untuk pengiriman ${
        isStoreCustomer ? 'toko' : 'retail'
      } adalah ${formatRupiah(minimumOrder)}`,
      400,
    );
  }

  // Create order with expiry (configurable via ORDER_EXPIRY_MINUTES, default 30)
  const expiryMinutes = parseInt(process.env.ORDER_EXPIRY_MINUTES ?? '30', 10);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const qualifiesForFreeShipping = isDelivery
    && !!freeShippingMinimumOrder
    && totalAmount >= freeShippingMinimumOrder;
  const finalShippingCost = qualifiesForFreeShipping ? 0 : (shippingCost ?? 0);

  const order = await prisma.order.create({
    data: {
      storeId,
      customerId: customer.id,
      publicOrderId: generatePublicOrderId(),
      status: 'pending_payment',
      customerName: customerName || customer.name || customerPhone,
      customerPhone,
      customerAddress: customerAddress || null,
      deliveryMethod: deliveryMethod || null,
      notes: notes || null,
      shippingCost: finalShippingCost,
      totalAmount: totalAmount + finalShippingCost,
      expiresAt,
      items: {
        createMany: { data: orderItems.map((item) => ({ ...item, storeId })) },
      },
    },
    include: {
      customer: true,
      items: true,
    },
  });

  return {
    publicOrderId: order.publicOrderId,
    status: order.status,
    totalAmount: order.totalAmount,
    expiresAt: order.expiresAt,
    shippingCost: order.shippingCost,
    minimumOrderApplied: isDelivery ? minimumOrder ?? null : null,
    freeShippingMinimumOrderApplied: isDelivery ? freeShippingMinimumOrder ?? null : null,
    isFreeShippingApplied: qualifiesForFreeShipping,
    items: order.items,
    store: {
      name: store.name,
      whatsappNumber: store.whatsappNumber,
      bankAccountName: store.bankAccountName,
      bankAccountNumber: store.bankAccountNumber,
      bankName: store.bankName,
      qrisImageUrl: store.qrisImageUrl,
    },
  };
};

export const uploadPaymentProof = async (
  publicOrderId: string,
  input: PaymentProofInput,
) => {
  const order = await prisma.order.findUnique({
    where: { publicOrderId },
    include: { paymentProof: true },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Lazy expiry check — in case pg_cron hasn't run yet
  const wasExpired = await expireOrderIfNeeded(order.id);
  if (wasExpired) {
    throw new AppError('Order has expired. Please create a new order.', 400);
  }

  if (order.status !== 'pending_payment') {
    throw new AppError(
      `Cannot upload payment proof for order with status: ${order.status}`,
      400,
    );
  }

  if (order.paymentProof) {
    // Update existing proof
    await prisma.paymentProof.update({
      where: { id: order.paymentProof.id },
      data: { imageUrl: input.imageUrl },
    });
  } else {
    // Create new proof
    await prisma.paymentProof.create({
      data: {
        storeId: order.storeId,
        orderId: order.id,
        imageUrl: input.imageUrl,
      },
    });
  }

  // Update order status
  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: { status: 'waiting_confirmation' },
    include: {
      customer: true,
      items: true,
      paymentProof: true,
    },
  });

  return {
    publicOrderId: updatedOrder.publicOrderId,
    status: updatedOrder.status,
    paymentProof: updatedOrder.paymentProof,
  };
};

export const getOrderStatus = async (publicOrderId: string) => {
  // Lazy expiry check before returning status
  const orderForExpiry = await prisma.order.findUnique({ where: { publicOrderId }, select: { id: true } });
  if (orderForExpiry) await expireOrderIfNeeded(orderForExpiry.id);

  const order = await prisma.order.findUnique({
    where: { publicOrderId },
    include: {
      items: true,
      paymentProof: true,
      shippingAssignment: {
        include: {
          shift: true,
        },
      },
      store: {
        select: {
          name: true,
          whatsappNumber: true,
          bankName: true,
          bankAccountNumber: true,
          bankAccountName: true,
          qrisImageUrl: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  return {
    publicOrderId: order.publicOrderId,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    deliveryMethod: order.deliveryMethod,
    notes: order.notes,
    shippingCost: order.shippingCost,
    totalAmount: order.totalAmount,
    expiresAt: order.expiresAt,
    createdAt: order.createdAt,
    items: order.items,
    paymentProof: order.paymentProof,
    shippingAssignment: order.shippingAssignment
      ? {
          shiftId: order.shippingAssignment.shiftId,
          deliveryDate: order.shippingAssignment.deliveryDate,
          driverName: order.shippingAssignment.driverName,
          assignedAt: order.shippingAssignment.assignedAt,
          assignedByAdminId: order.shippingAssignment.assignedByAdminId,
          shiftName: order.shippingAssignment.shift.name,
          shiftStartTime: order.shippingAssignment.shift.startTime,
          shiftEndTime: order.shippingAssignment.shift.endTime,
          shiftLabel: `${order.shippingAssignment.shift.name} (${order.shippingAssignment.shift.startTime} - ${order.shippingAssignment.shift.endTime})`,
        }
      : null,
    store: order.store,
  };
};
