import { OrderComplaintStatus, PaymentMethod, Prisma } from '@prisma/client';

import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';
import { CREDIT_EXCLUDED_STATUSES, getPaidCreditAmount, getRemainingCreditAmount } from '../../../utils/credit';
import { restoreOrderStock } from '../../../utils/order-stock';
import { recordStockMovement } from '../../../utils/stock-ledger';
import { resolveVariantDiscount } from '../../../utils/variant-discount';
import { populateVariantDescriptions } from '../../../utils/order-item';

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

const ORDER_ITEM_SNAPSHOT_FIELDS = ['originalPrice', 'discountAmount', 'discountRuleName'] as const;
const OPEN_COMPLAINT_STATUSES: OrderComplaintStatus[] = ['open', 'accepted'];

const supportsOrderItemDiscountSnapshot = (() => {
  const orderItemModel = Prisma.dmmf.datamodel.models.find((model) => model.name === 'OrderItem');
  if (!orderItemModel) {
    return false;
  }

  const fieldNames = new Set(orderItemModel.fields.map((field) => field.name));
  return ORDER_ITEM_SNAPSHOT_FIELDS.every((field) => fieldNames.has(field));
})();

// ─── Helper: Generate public order ID ─────────────────────────────────────────

const generatePublicOrderId = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

const parseEvidenceImageUrls = (value: Prisma.JsonValue): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
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
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        storeId: true,
        status: true,
        paymentMethod: true,
        expiresAt: true,
        items: {
          select: {
            variantId: true,
            quantity: true,
          },
        },
      },
    });

    if (!order || order.status !== 'pending_payment') return false;
    if (order.paymentMethod === 'credit') return false;
    if (!order.expiresAt || order.expiresAt > new Date()) return false;

    const transition = await tx.order.updateMany({
      where: {
        id: order.id,
        status: 'pending_payment',
      },
      data: { status: 'expired_unpaid' },
    });

    if (transition.count === 0) {
      return false;
    }

    await restoreOrderStock(tx, {
      storeId: order.storeId,
      orderId: order.id,
      items: order.items,
      notes: 'Restore stok otomatis karena order expired unpaid',
    });

    return true;
  });
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const checkout = async (input: CheckoutInput) => {
  const {
    storeId, customerName, customerPhone, customerEmail,
    customerAddress, deliveryMethod, paymentMethod: rawPaymentMethod, notes, shippingCost,
    items, authenticatedCustomerId,
  } = input;
  const paymentMethod = resolvePaymentMethod(rawPaymentMethod);
  const publicOrderId = generatePublicOrderId();

  // Validate store exists
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      bankAccounts: {
        orderBy: { sortOrder: 'asc' as const },
        select: { id: true, bankName: true, accountNumber: true, accountHolder: true },
      },
    },
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
    originalPrice: number;
    price: number;
    discountAmount: number;
    discountRuleName: string | null;
    quantity: number;
  }[] = [];

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: {
        productDiscountRules: {
          where: { isActive: true },
          orderBy: [
            { priority: 'desc' },
            { minThreshold: 'desc' },
            { createdAt: 'asc' },
          ],
        },
        variants: {
          include: {
            optionValues: {
              include: { optionValue: { include: { option: true } } },
            },
            discountRules: {
              where: { isActive: true },
              orderBy: [
                { priority: 'desc' },
                { minThreshold: 'desc' },
                { createdAt: 'asc' },
              ],
            },
          },
        },
      },
    });

    if (!product) {
      throw new AppError(`Product not found: ${item.productId}`, 404);
    }

    if (product.storeId !== storeId) {
      throw new AppError('Product does not belong to this store', 400);
    }

    const variant = item.variantId
      ? product.variants.find((v: (typeof product.variants)[number]) => v.id === item.variantId)
      : (product.variants.find((v: (typeof product.variants)[number]) => v.isDefault) || product.variants[0]);

    if (!variant) {
      throw new AppError(`Variant not found for product: ${item.productId}`, 404);
    }

    if (variant.stock < item.quantity) {
      throw new AppError(
        `Insufficient stock for variant: ${variant.id}`,
        400,
      );
    }

    const isWholesale = isWholesaleCustomer;
    const retailPrice = variant.priceOverride ?? product.basePrice;
    const wholesalePrice = variant.wholesalePriceOverride ?? product.wholesalePrice ?? retailPrice;
    const rawUnitPrice = isWholesale ? wholesalePrice : retailPrice;
    const combinedRules = [
      ...variant.discountRules.map((rule) => ({
        ...rule,
        source: 'variant' as const,
      })),
      ...product.productDiscountRules
        .filter((rule) => rule.targetVariantIds.length === 0 || rule.targetVariantIds.includes(variant.id))
        .map((rule) => ({
          ...rule,
          source: 'product' as const,
        })),
    ];

    const pricing = resolveVariantDiscount(combinedRules, {
      quantity: item.quantity,
      unitPrice: rawUnitPrice,
      customerType: customer.type,
    });

    // Build variant description from selected option values, fallback to variant.name
    const variantDescription = variant.optionValues.length > 0
      ? variant.optionValues
        .map(
          (ov: (typeof variant.optionValues)[number]) =>
            `${ov.optionValue.option.name}: ${ov.optionValue.value}`,
        )
        .join(', ')
      : (!variant.isDefault && variant.name ? variant.name : null);

    orderItems.push({
      variantId: variant.id,
      productName: product.name,
      variantDescription,
      originalPrice: rawUnitPrice,
      price: pricing.effectiveUnitPrice,
      discountAmount: pricing.lineDiscount,
      discountRuleName: pricing.rule?.name ?? null,
      quantity: item.quantity,
    });

    totalAmount += pricing.effectiveLineTotal;
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

  let termOfPaymentSnapshot = 0;

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

    termOfPaymentSnapshot = customerCredit.termOfPayment ?? 0;

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

  const order = await prisma.$transaction(async (tx) => {
    for (const item of orderItems) {
      if (!item.variantId) {
        continue;
      }

      const stockUpdate = await tx.variant.updateMany({
        where: {
          id: item.variantId,
          storeId,
          stock: {
            gte: item.quantity,
          },
        },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });

      if (stockUpdate.count === 0) {
        throw new AppError(
          `Insufficient stock for variant: ${item.variantId}`,
          400,
        );
      }

      const updatedVariant = await tx.variant.findUnique({
        where: { id: item.variantId },
        select: {
          id: true,
          productId: true,
          stock: true,
        },
      });

      if (!updatedVariant) {
        throw new AppError(`Variant not found: ${item.variantId}`, 404);
      }

      await recordStockMovement(tx, {
        storeId,
        productId: updatedVariant.productId,
        variantId: updatedVariant.id,
        stockStatus: 'out',
        quantity: item.quantity,
        category: 'sale',
        balanceAfter: updatedVariant.stock,
        referenceType: 'checkout',
        referenceId: publicOrderId,
        notes: 'Pengurangan stok dari proses checkout',
      });
    }

    return tx.order.create({
      data: {
        storeId,
        customerId: customer.id,
        publicOrderId,
        status: initialStatus,
        paymentMethod,
        termOfPaymentSnapshot,
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
          createMany: {
            data: orderItems.map((item) => ({
              variantId: item.variantId,
              productName: item.productName,
              variantDescription: item.variantDescription,
              price: item.price,
              quantity: item.quantity,
              storeId,
              ...(supportsOrderItemDiscountSnapshot
                ? {
                  originalPrice: item.originalPrice,
                  discountAmount: item.discountAmount,
                  discountRuleName: item.discountRuleName,
                }
                : {}),
            })),
          },
        },
      },
      include: {
        customer: true,
        items: true,
      },
    });
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
      bankAccounts: store.bankAccounts,
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
      complaints: {
        orderBy: {
          createdAt: 'desc',
        },
      },
      store: {
        select: {
          name: true,
          whatsappNumber: true,
          qrisImageUrl: true,
          bankAccounts: {
            orderBy: { sortOrder: 'asc' as const },
            select: {
              id: true,
              bankName: true,
              accountNumber: true,
              accountHolder: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  const items = await populateVariantDescriptions(order.items);

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
    adminCompletedAt: order.adminCompletedAt,
    customerCompletedAt: order.customerCompletedAt,
    expiresAt: order.expiresAt,
    createdAt: order.createdAt,
    items,
    complaints: order.complaints.map((complaint) => ({
      ...complaint,
      evidenceImageUrls: parseEvidenceImageUrls(complaint.evidenceImageUrls),
    })),
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

export const completeOrder = async (publicOrderId: string) => {
  const order = await prisma.order.findUnique({
    where: { publicOrderId },
    include: {
      complaints: {
        where: {
          status: {
            in: OPEN_COMPLAINT_STATUSES,
          },
        },
        select: {
          id: true,
        },
      },
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  if (order.status !== 'shipped' && order.status !== 'done') {
    throw new AppError('Order hanya bisa diselesaikan setelah dikirim', 400);
  }

  if (order.complaints.length > 0) {
    throw new AppError('Tidak bisa menyelesaikan pesanan saat komplain masih aktif', 400);
  }

  return prisma.order.update({
    where: {
      id: order.id,
    },
    data: {
      customerCompletedAt: order.customerCompletedAt ?? new Date(),
      status: order.adminCompletedAt ? 'done' : 'shipped',
    },
    select: {
      publicOrderId: true,
      status: true,
      adminCompletedAt: true,
      customerCompletedAt: true,
    },
  });
};
