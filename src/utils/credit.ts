import { OrderStatus } from '@prisma/client';

export const CREDIT_EXCLUDED_STATUSES: OrderStatus[] = [
  'cancelled',
  'expired_unpaid',
];

export interface CreditPaymentLike {
  amount: number;
}

export const getPaidCreditAmount = (
  payments: CreditPaymentLike[],
): number => payments.reduce((sum, payment) => sum + payment.amount, 0);

export const getRemainingCreditAmount = ({
  totalAmount,
  paidAmount,
  creditSettledAt,
}: {
  totalAmount: number;
  paidAmount: number;
  creditSettledAt?: Date | string | null;
}): number => {
  if (creditSettledAt) {
    return 0;
  }

  return Math.max(totalAmount - paidAmount, 0);
};

export const isCreditSettled = ({
  totalAmount,
  paidAmount,
  creditSettledAt,
}: {
  totalAmount: number;
  paidAmount: number;
  creditSettledAt?: Date | string | null;
}): boolean => Boolean(creditSettledAt) || paidAmount >= totalAmount;
