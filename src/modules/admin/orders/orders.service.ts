import { OrderStatus } from '@prisma/client';

import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';

// ─── Service ──────────────────────────────────────────────────────────────────

export const listOrders = async (
  storeId: string,
  status?: OrderStatus,
) => {
  return prisma.order.findMany({
    where: {
      storeId,
      ...(status && { status }),
    },
    include: {
      customer: true,
      items: true,
      paymentProof: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getOrder = async (storeId: string, orderId: string) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: {
      customer: true,
      items: true,
      paymentProof: true,
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  return order;
};

export const confirmPayment = async (storeId: string, orderId: string) => {
  const order = await getOrder(storeId, orderId);

  if (order.status !== 'waiting_confirmation') {
    throw new AppError(
      `Cannot confirm payment for order with status: ${order.status}`,
      400,
    );
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { status: 'paid' },
    include: {
      customer: true,
      items: true,
      paymentProof: true,
    },
  });
};

export const updateOrderStatus = async (
  storeId: string,
  orderId: string,
  status: OrderStatus,
) => {
  await getOrder(storeId, orderId);

  return prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: {
      customer: true,
      items: true,
      paymentProof: true,
    },
  });
};
