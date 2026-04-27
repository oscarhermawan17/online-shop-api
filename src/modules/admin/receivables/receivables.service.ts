import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';
import {
  CREDIT_EXCLUDED_STATUSES,
  getPaidCreditAmount,
  getRemainingCreditAmount,
  isCreditSettled,
} from '../../../utils/credit';
import { populateVariantDescriptions } from '../../../utils/order-item';

const receivableInclude = {
  creditPayments: {
    orderBy: {
      receivedAt: 'desc',
    },
  },
  items: true,
} as const;

const toReceivableResponse = (
  order: {
    id: string;
    publicOrderId: string;
    customerName: string | null;
    customerPhone: string | null;
    totalAmount: number;
    createdAt: Date;
    status: string;
    creditSettledAt: Date | null;
    shippingCost: number;
    termOfPaymentSnapshot: number;
    creditPayments: {
      id: string;
      amount: number;
      receivedAt: Date;
      createdAt: Date;
    }[];
    items: {
      id: string;
      productName: string;
      variantDescription: string | null;
      price: number;
      quantity: number;
      originalPrice: number | null;
      discountAmount: number;
      discountRuleName: string | null;
      imageUrl?: string | null;
    }[];
  },
) => {
  const paidAmount = getPaidCreditAmount(order.creditPayments);
  const remainingAmount = getRemainingCreditAmount({
    totalAmount: order.totalAmount,
    paidAmount,
    creditSettledAt: order.creditSettledAt,
  });
  const settled = isCreditSettled({
    totalAmount: order.totalAmount,
    paidAmount,
    creditSettledAt: order.creditSettledAt,
  });

  const termOfPayment = order.termOfPaymentSnapshot ?? 0;
  const dueDate = termOfPayment > 0
    ? new Date(order.createdAt.getTime() + termOfPayment * 24 * 60 * 60 * 1000)
    : null;

  return {
    id: order.id,
    publicOrderId: order.publicOrderId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    totalAmount: order.totalAmount,
    paidAmount,
    remainingAmount,
    status: order.status,
    createdAt: order.createdAt,
    creditSettledAt: order.creditSettledAt,
    isSettled: settled,
    termOfPayment,
    dueDate,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      variantDescription: item.variantDescription,
      price: item.price,
      quantity: item.quantity,
      originalPrice: item.originalPrice,
      discountAmount: item.discountAmount,
      discountRuleName: item.discountRuleName,
    })),
    payments: order.creditPayments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      receivedAt: payment.receivedAt,
      createdAt: payment.createdAt,
    })),
  };
};

export interface ListReceivablesInput {
  storeId: string;
  page?: number;
  limit?: number;
  settled?: 'settled' | 'unsettled';
  startDate?: Date;
  endDateExclusive?: Date;
}

export interface ListReceivablesResult {
  receivables: ReturnType<typeof toReceivableResponse>[];
  total: number;
}

export const listReceivables = async (input: ListReceivablesInput): Promise<ListReceivablesResult> => {
  const {
    storeId,
    page,
    limit,
    settled,
    startDate,
    endDateExclusive,
  } = input;

  const shouldPaginate = Number.isInteger(page) && Number.isInteger(limit);

  const where = {
    storeId,
    paymentMethod: 'credit' as const,
    status: {
      notIn: CREDIT_EXCLUDED_STATUSES,
    },
    ...(settled === 'settled' ? { creditSettledAt: { not: null } } : {}),
    ...(settled === 'unsettled' ? { creditSettledAt: null } : {}),
    ...(startDate || endDateExclusive
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDateExclusive ? { lt: endDateExclusive } : {}),
          },
        }
      : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: receivableInclude,
      orderBy: { createdAt: 'desc' },
      ...(shouldPaginate
        ? {
            skip: ((page as number) - 1) * (limit as number),
            take: limit as number,
          }
        : {}),
    }),
  ]);

  const allItems = await populateVariantDescriptions(orders.flatMap((o) => o.items));
  const itemMap = new Map(allItems.map((i) => [i.id, i]));
  const resolved = orders.map((o) => ({ ...o, items: o.items.map((i) => itemMap.get(i.id) ?? i) }));

  return {
    receivables: resolved.map(toReceivableResponse),
    total,
  };
};

export interface AddReceivablePaymentInput {
  orderId: string;
  storeId: string;
  amount: number;
  receivedAt: string;
}

export const addReceivablePayment = async (
  input: AddReceivablePaymentInput,
) => {
  const { orderId, storeId, amount, receivedAt } = input;

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new AppError('Nominal pembayaran harus lebih dari 0', 400);
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      storeId,
    },
    include: receivableInclude,
  });

  if (!order) {
    throw new AppError('Invoice credit tidak ditemukan', 404);
  }

  if (order.paymentMethod !== 'credit') {
    throw new AppError('Order ini bukan invoice credit', 400);
  }

  if (order.status === 'cancelled' || order.status === 'expired_unpaid') {
    throw new AppError('Invoice credit ini tidak dapat menerima pembayaran', 400);
  }

  const paidAmount = getPaidCreditAmount(order.creditPayments);
  const remainingAmount = getRemainingCreditAmount({
    totalAmount: order.totalAmount,
    paidAmount,
    creditSettledAt: order.creditSettledAt,
  });

  if (remainingAmount <= 0) {
    throw new AppError('Invoice credit ini sudah lunas', 400);
  }

  if (amount > remainingAmount) {
    throw new AppError('Nominal pembayaran melebihi sisa tagihan invoice', 400);
  }

  const parsedReceivedAt = /^\d{4}-\d{2}-\d{2}$/.test(receivedAt)
    ? new Date(`${receivedAt}T00:00:00.000Z`)
    : new Date(receivedAt);

  if (Number.isNaN(parsedReceivedAt.getTime())) {
    throw new AppError('Tanggal penerimaan tidak valid', 400);
  }

  const nextPaidAmount = paidAmount + amount;
  const shouldSettle = nextPaidAmount >= order.totalAmount;

  const updatedOrder = await prisma.$transaction(async (tx) => {
    await tx.creditPayment.create({
      data: {
        storeId,
        orderId: order.id,
        amount,
        receivedAt: parsedReceivedAt,
      },
    });

    return tx.order.update({
      where: { id: order.id },
      data: {
        creditSettledAt: shouldSettle ? parsedReceivedAt : null,
      },
      include: receivableInclude,
    });
  });

  return toReceivableResponse(updatedOrder);
};
