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
  customerPhone: string;
  customerEmail?: string;
  items: CheckoutItem[];
}

export interface PaymentProofInput {
  imageUrl: string;
}

// ─── Helper: Generate public order ID ─────────────────────────────────────────

const generatePublicOrderId = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const checkout = async (input: CheckoutInput) => {
  const { storeId, customerPhone, customerEmail, items } = input;

  // Validate store exists
  const store = await prisma.store.findUnique({
    where: { id: storeId },
  });

  if (!store) {
    throw new AppError('Store not found', 404);
  }

  // Find or create customer
  let customer = await prisma.customer.findFirst({
    where: { phone: customerPhone },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
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

  // Process items and calculate total
  let totalAmount = 0;
  const orderItems: {
    productName: string;
    variantDescription: string | null;
    price: number;
    quantity: number;
  }[] = [];

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: {
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

    let price = product.basePrice;
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

      price = variant.priceOverride ?? product.basePrice;

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
      productName: product.name,
      variantDescription,
      price,
      quantity: item.quantity,
    });

    totalAmount += price * item.quantity;
  }

  // Create order with expiry (24 hours)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const order = await prisma.order.create({
    data: {
      storeId,
      customerId: customer.id,
      publicOrderId: generatePublicOrderId(),
      status: 'pending_payment',
      totalAmount,
      expiresAt,
      items: {
        createMany: { data: orderItems },
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
  const order = await prisma.order.findUnique({
    where: { publicOrderId },
    include: {
      items: true,
      paymentProof: true,
      store: {
        select: {
          name: true,
          whatsappNumber: true,
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
    totalAmount: order.totalAmount,
    expiresAt: order.expiresAt,
    createdAt: order.createdAt,
    items: order.items,
    paymentProof: order.paymentProof,
    store: order.store,
  };
};
