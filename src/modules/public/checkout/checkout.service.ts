import { PaymentMethod } from '@prisma/client';

import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';
import { CREDIT_EXCLUDED_STATUSES, getPaidCreditAmount, getRemainingCreditAmount } from '../../../utils/credit';

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
  paymentMethod?: PaymentMethod;
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

const resolvePaymentMethod = (value?: string): PaymentMethod => {
  if (value === 'credit') {
    return 'credit';
  }

  return 'bank_transfer';
};

const getOutstandingCreditTotal = async (
  storeId: string,
  customerId: string,
): Promise<number> => {
  const orders = await prisma.order.findMany({
    where: {
      storeId,
      customerId,
      paymentMethod: 'credit',
      status: {
        notIn: CREDIT_EXCLUDED_STATUSES,
      },
    },
    select: {
      totalAmount: true,
      creditSettledAt: true,
      creditPayments: {
        select: {
          amount: true,
        },
      },
    },
  });

  return orders.reduce((sum, order) => {
    const paidAmount = getPaidCreditAmount(order.creditPayments);
    return sum + getRemainingCreditAmount({
      totalAmount: order.totalAmount,
      paidAmount,
      creditSettledAt: order.creditSettledAt,
    });
  }, 0);
};

// ─── Helper: Lazy expiry check ────────────────────────────────────────────────
// Fallback for orders that pg_cron hasn't processed yet.
// Restores stock and marks order as expired_unpaid.

const expireOrderIfNeeded = async (orderId: string): Promise<boolean> => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, creditPayments: true },
  });

  if (!order || order.status !== 'pending_payment') return false;
  if (order.paymentMethod === 'credit') return false;
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
    customerAddress, deliveryMethod, paymentMethod: rawPaymentMethod, notes, shippingCost,
    items, authenticatedCustomerId,
  } = input;
  const paymentMethod = resolvePaymentMethod(rawPaymentMethod);

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
    if (customer.storeId !== storeId) {
      throw new AppError('Authenticated customer does not belong to this store', 400);
    }

    if (!customer.isActive) {
      throw new AppError('Akun pelanggan ini sedang dinonaktifkan', 403);
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

  const isWholesaleCustomer = customer.type === 'wholesale';

  if (paymentMethod === 'credit' && !authenticatedCustomerId) {
    throw new AppError('Metode pembayaran credit hanya tersedia untuk user wholesale yang login', 400);
  }

  if (paymentMethod === 'credit' && !isWholesaleCustomer) {
    throw new AppError('Metode pembayaran credit hanya tersedia untuk user wholesale', 400);
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

    const isWholesale = isWholesaleCustomer;
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
  const minimumOrder = isWholesaleCustomer
    ? store.deliveryStoreMinimumOrder
    : store.deliveryRetailMinimumOrder;
  const freeShippingMinimumOrder = isWholesaleCustomer
    ? store.deliveryStoreFreeShippingMinimumOrder
    : store.deliveryRetailFreeShippingMinimumOrder;

  if (isDelivery && minimumOrder && totalAmount < minimumOrder) {
    throw new AppError(
      `Minimal belanja untuk pengiriman ${
        isWholesaleCustomer ? 'wholesale' : 'base'
      } adalah ${formatRupiah(minimumOrder)}`,
      400,
    );
  }

  const qualifiesForFreeShipping = isDelivery
    && !!freeShippingMinimumOrder
    && totalAmount >= freeShippingMinimumOrder;
  const finalShippingCost = qualifiesForFreeShipping ? 0 : (shippingCost ?? 0);
  const finalTotalAmount = totalAmount + finalShippingCost;

  if (paymentMethod === 'credit') {
    const customerCredit = await prisma.customerCredit.findFirst({
      where: {
        storeId,
        customerId: customer.id,
      },
    });

    if (!customerCredit || customerCredit.creditLimit <= 0) {
      throw new AppError('Limit credit untuk pelanggan ini belum diatur', 400);
    }

    const outstandingCredit = await getOutstandingCreditTotal(storeId, customer.id);

    if (outstandingCredit + finalTotalAmount > customerCredit.creditLimit) {
      throw new AppError(
        `Limit credit tidak mencukupi. Terpakai ${formatRupiah(outstandingCredit)} dari ${formatRupiah(customerCredit.creditLimit)}`,
        400,
      );
    }
  }

  const expiryMinutes = parseInt(process.env.ORDER_EXPIRY_MINUTES ?? '30', 10);
  const expiresAt = paymentMethod === 'bank_transfer'
    ? new Date(Date.now() + expiryMinutes * 60 * 1000)
    : null;
  const initialStatus = paymentMethod === 'credit' ? 'paid' : 'pending_payment';

  const order = await prisma.order.create({
    data: {
      storeId,
      customerId: customer.id,
      publicOrderId: generatePublicOrderId(),
      status: initialStatus,
      paymentMethod,
      customerName: customerName || customer.name || customerPhone,
      customerPhone,
      customerAddress: customerAddress || null,
      deliveryMethod: deliveryMethod || null,
      notes: notes || null,
      shippingCost: finalShippingCost,
      totalAmount: finalTotalAmount,
      creditSettledAt: null,
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
    paymentMethod: order.paymentMethod,
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

  if (order.paymentMethod === 'credit') {
    throw new AppError('Order credit tidak memerlukan upload bukti pembayaran', 400);
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
    paymentMethod: updatedOrder.paymentMethod,
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
    paymentMethod: order.paymentMethod,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    deliveryMethod: order.deliveryMethod,
    notes: order.notes,
    shippingCost: order.shippingCost,
    totalAmount: order.totalAmount,
    creditSettledAt: order.creditSettledAt,
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
