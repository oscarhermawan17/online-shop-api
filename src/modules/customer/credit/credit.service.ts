import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';
import { CREDIT_EXCLUDED_STATUSES, getPaidCreditAmount, getRemainingCreditAmount } from '../../../utils/credit';

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
