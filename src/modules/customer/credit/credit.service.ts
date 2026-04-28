import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';
import { CREDIT_EXCLUDED_STATUSES, getPaidCreditAmount, getRemainingCreditAmount } from '../../../utils/credit';
import { populateVariantDescriptions } from '../../../utils/order-item';

export const getMyCreditOrders = async (storeId: string, customerId: string) => {
  const orders = await prisma.order.findMany({
    where: { storeId, customerId, paymentMethod: 'credit' },
    include: {
      items: true,
      paymentProof: true,
      creditPayments: {
        select: { id: true, amount: true, receivedAt: true },
        orderBy: { receivedAt: 'asc' },
      },
      shippingAssignment: {
        include: { shift: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const allItems = await populateVariantDescriptions(orders.flatMap((o) => o.items));
  const itemMap = new Map(allItems.map((item) => [item.id, item]));

  return orders.map((order) => {
    const paidAmount = getPaidCreditAmount(order.creditPayments);
    const remainingAmount = getRemainingCreditAmount({
      totalAmount: order.totalAmount,
      paidAmount,
      creditSettledAt: order.creditSettledAt,
    });

    const termOfPayment = order.termOfPaymentSnapshot ?? 0;
    const dueDate = termOfPayment > 0
      ? new Date(new Date(order.createdAt).getTime() + termOfPayment * 24 * 60 * 60 * 1000).toISOString()
      : null;

    return {
      ...order,
      items: order.items.map((item) => itemMap.get(item.id) ?? item),
      paidAmount,
      remainingAmount,
      termOfPayment,
      dueDate,
    };
  });
};

export const getMyCreditSummary = async (
  storeId: string,
  customerId: string,
) => {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      storeId,
    },
    select: {
      type: true,
      isActive: true,
    },
  });

  if (!customer || !customer.isActive) {
    throw new AppError('Customer not found', 404);
  }

  if (customer.type !== 'wholesale') {
    throw new AppError('Ringkasan credit hanya tersedia untuk user wholesale', 403);
  }

  const credit = await prisma.customerCredit.findFirst({
    where: {
      storeId,
      customerId,
    },
    select: {
      creditLimit: true,
      updatedAt: true,
    },
  });

  const creditOrders = await prisma.order.findMany({
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

  const outstandingCredit = creditOrders.reduce((sum, order) => {
    const paidAmount = getPaidCreditAmount(order.creditPayments);
    return sum + getRemainingCreditAmount({
      totalAmount: order.totalAmount,
      paidAmount,
      creditSettledAt: order.creditSettledAt,
    });
  }, 0);
  const creditLimit = credit?.creditLimit ?? 0;

  return {
    creditLimit,
    outstandingCredit,
    remainingCredit: Math.max(creditLimit - outstandingCredit, 0),
    updatedAt: credit?.updatedAt ?? null,
  };
};
