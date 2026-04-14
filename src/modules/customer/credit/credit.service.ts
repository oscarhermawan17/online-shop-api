import prisma from '../../../config/prisma';
import { CREDIT_EXCLUDED_STATUSES, getPaidCreditAmount, getRemainingCreditAmount } from '../../../utils/credit';

export const getMyCreditSummary = async (
  storeId: string,
  customerId: string,
) => {
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
