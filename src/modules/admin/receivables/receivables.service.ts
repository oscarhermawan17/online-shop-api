import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';
import {
  CREDIT_EXCLUDED_STATUSES,
  getPaidCreditAmount,
  getRemainingCreditAmount,
  isCreditSettled,
} from '../../../utils/credit';

const receivableInclude = {
  creditPayments: {
    orderBy: {
      receivedAt: 'desc',
    },
  },
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
    creditPayments: {
      id: string;
      amount: number;
      receivedAt: Date;
      createdAt: Date;
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
    payments: order.creditPayments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      receivedAt: payment.receivedAt,
      createdAt: payment.createdAt,
    })),
  };
};

export const listReceivables = async (storeId: string) => {
  const orders = await prisma.order.findMany({
    where: {
      storeId,
      paymentMethod: 'credit',
      status: {
        notIn: CREDIT_EXCLUDED_STATUSES,
      },
    },
    include: receivableInclude,
    orderBy: { createdAt: 'desc' },
  });

  return orders.map(toReceivableResponse);
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
