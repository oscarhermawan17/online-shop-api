import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';
import { CREDIT_EXCLUDED_STATUSES, getPaidCreditAmount, getRemainingCreditAmount } from '../../../utils/credit';

export const listCredits = async (storeId: string) => {
  const customers = await prisma.customer.findMany({
    where: {
      storeId,
      type: 'wholesale',
    },
    include: {
      credit: true,
      orders: {
        where: {
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
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return customers.map((customer) => {
    const outstandingCredit = customer.orders.reduce(
      (
        sum: number,
        order: {
          totalAmount: number;
          creditSettledAt: Date | null;
          creditPayments: { amount: number }[];
        },
      ) => {
        const paidAmount = getPaidCreditAmount(order.creditPayments);
        return sum + getRemainingCreditAmount({
          totalAmount: order.totalAmount,
          paidAmount,
          creditSettledAt: order.creditSettledAt,
        });
      },
      0,
    );
    const creditLimit = customer.credit?.creditLimit ?? 0;

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      type: customer.type,
      isActive: customer.isActive,
      hasAccount: !!customer.password,
      createdAt: customer.createdAt,
      creditLimit,
      outstandingCredit,
      remainingCredit: Math.max(creditLimit - outstandingCredit, 0),
      creditUpdatedAt: customer.credit?.updatedAt ?? null,
    };
  });
};

export interface UpsertCreditInput {
  storeId: string;
  customerId: string;
  creditLimit: number;
}

export const upsertCreditLimit = async (
  input: UpsertCreditInput,
) => {
  const { storeId, customerId, creditLimit } = input;

  if (!Number.isInteger(creditLimit) || creditLimit < 0) {
    throw new AppError('Limit credit harus berupa angka bulat 0 atau lebih', 400);
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      storeId,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      type: true,
    },
  });

  if (!customer) {
    throw new AppError('Customer not found', 404);
  }

  if (customer.type !== 'wholesale') {
    throw new AppError('Limit credit hanya bisa diatur untuk user wholesale', 400);
  }

  const credit = await prisma.customerCredit.upsert({
    where: {
      customerId,
    },
    create: {
      storeId,
      customerId,
      creditLimit,
    },
    update: {
      creditLimit,
    },
    select: {
      id: true,
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

  const usedCredit = creditOrders.reduce((sum, order) => {
    const paidAmount = getPaidCreditAmount(order.creditPayments);
    return sum + getRemainingCreditAmount({
      totalAmount: order.totalAmount,
      paidAmount,
      creditSettledAt: order.creditSettledAt,
    });
  }, 0);

  return {
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    creditId: credit.id,
    creditLimit: credit.creditLimit,
    outstandingCredit: usedCredit,
    remainingCredit: Math.max(credit.creditLimit - usedCredit, 0),
    updatedAt: credit.updatedAt,
  };
};
