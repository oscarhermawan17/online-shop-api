import { OrderStatus } from '@prisma/client';

import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';
import { getPaidCreditAmount, getRemainingCreditAmount, isCreditSettled } from '../../../utils/credit';
import { restoreOrderStock } from '../../../utils/order-stock';
import { toAdminOrderResponse } from './orders.mapper';

const adminOrderInclude = {
  customer: true,
  items: true,
  paymentProof: true,
  shippingAssignment: {
    include: {
      shift: true,
    },
  },
} as const;

// ─── Service ──────────────────────────────────────────────────────────────────

export const listOrders = async (
  storeId: string,
  status?: OrderStatus,
) => {
  const orders = await prisma.order.findMany({
    where: {
      storeId,
      ...(status && { status }),
    },
    include: adminOrderInclude,
    orderBy: { createdAt: 'desc' },
  });

  return orders.map(toAdminOrderResponse);
};

export const getOrder = async (storeId: string, orderId: string) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: adminOrderInclude,
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  return toAdminOrderResponse(order);
};

export const confirmPayment = async (storeId: string, orderId: string) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  if (order.paymentMethod === 'credit') {
    throw new AppError('Order credit tidak menggunakan konfirmasi bukti pembayaran', 400);
  }

  if (order.status !== 'waiting_confirmation') {
    throw new AppError(
      `Cannot confirm payment for order with status: ${order.status}`,
      400,
    );
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status: 'paid' },
    include: adminOrderInclude,
  });

  return toAdminOrderResponse(updatedOrder);
};

export const settleCredit = async (storeId: string, orderId: string) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: {
      creditPayments: true,
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  if (order.paymentMethod !== 'credit') {
    throw new AppError('Order ini bukan transaksi credit', 400);
  }

  const paidAmount = getPaidCreditAmount(order.creditPayments);
  const remainingAmount = getRemainingCreditAmount({
    totalAmount: order.totalAmount,
    paidAmount,
    creditSettledAt: order.creditSettledAt,
  });

  if (isCreditSettled({
    totalAmount: order.totalAmount,
    paidAmount,
    creditSettledAt: order.creditSettledAt,
  }) || remainingAmount <= 0) {
    throw new AppError('Invoice credit untuk order ini sudah dilunasi', 400);
  }

  if (order.status === 'cancelled' || order.status === 'expired_unpaid') {
    throw new AppError(`Tidak bisa melunasi credit untuk order berstatus ${order.status}`, 400);
  }

  const settledAt = new Date();

  const updatedOrder = await prisma.$transaction(async (tx) => {
    await tx.creditPayment.create({
      data: {
        storeId,
        orderId: order.id,
        amount: remainingAmount,
        receivedAt: settledAt,
      },
    });

    return tx.order.update({
      where: { id: orderId },
      data: {
        creditSettledAt: settledAt,
      },
      include: adminOrderInclude,
    });
  });

  return toAdminOrderResponse(updatedOrder);
};

export const updateOrderStatus = async (
  storeId: string,
  orderId: string,
  status: OrderStatus,
) => {
  const existingOrder = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: {
      items: {
        select: {
          variantId: true,
          quantity: true,
        },
      },
    },
  });

  if (!existingOrder) {
    throw new AppError('Order not found', 404);
  }

  const shouldRestoreReservedStock = (
    (status === 'cancelled' || status === 'expired_unpaid')
    && (existingOrder.status === 'pending_payment' || existingOrder.status === 'waiting_confirmation')
  );

  const updatedOrder = await prisma.$transaction(async (tx) => {
    if (shouldRestoreReservedStock) {
      const transition = await tx.order.updateMany({
        where: {
          id: orderId,
          storeId,
          status: {
            in: ['pending_payment', 'waiting_confirmation'],
          },
        },
        data: { status },
      });

      if (transition.count === 0) {
        throw new AppError('Order status sudah berubah, silakan muat ulang data', 409);
      }

      await restoreOrderStock(tx, {
        storeId,
        orderId,
        items: existingOrder.items,
        notes: `Restore stok otomatis karena order diubah ke status ${status}`,
      });

      const order = await tx.order.findFirst({
        where: { id: orderId, storeId },
        include: adminOrderInclude,
      });

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      return order;
    }

    return tx.order.update({
      where: { id: orderId },
      data: { status },
      include: adminOrderInclude,
    });
  });

  return toAdminOrderResponse(updatedOrder);
};

export interface ShipOrderInput {
  shiftId: string;
  deliveryDate: string;
  driverName: string;
  assignedByAdminId?: string;
}

export const shipOrder = async (
  storeId: string,
  orderId: string,
  input: ShipOrderInput,
) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  if (order.deliveryMethod !== 'delivery') {
    throw new AppError('Only delivery orders can be scheduled for shipping', 400);
  }

  if (order.status !== 'paid') {
    throw new AppError(
      `Cannot ship order with status: ${order.status}`,
      400,
    );
  }

  const shift = await prisma.shippingShift.findFirst({
    where: {
      id: input.shiftId,
      storeId,
      isActive: true,
    },
  });

  if (!shift) {
    throw new AppError('Shipping shift not found or inactive', 404);
  }

  const driverName = input.driverName.trim();

  if (!driverName) {
    throw new AppError('Driver name is required', 400);
  }

  const driver = await prisma.shippingDriver.findFirst({
    where: {
      storeId,
      name: driverName,
      isActive: true,
    },
  });

  if (!driver) {
    throw new AppError('Shipping driver not found or inactive', 404);
  }

  const deliveryDate = new Date(`${input.deliveryDate}T00:00:00.000Z`);

  if (Number.isNaN(deliveryDate.getTime())) {
    throw new AppError('Invalid delivery date', 400);
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    await tx.orderShippingAssignment.upsert({
      where: { orderId: order.id },
      create: {
        storeId,
        orderId: order.id,
        shiftId: shift.id,
        deliveryDate,
        driverName,
        assignedByAdminId: input.assignedByAdminId ?? null,
      },
      update: {
        shiftId: shift.id,
        deliveryDate,
        driverName,
        assignedAt: new Date(),
        assignedByAdminId: input.assignedByAdminId ?? null,
      },
    });

    return tx.order.update({
      where: { id: order.id },
      data: { status: 'shipped' },
      include: adminOrderInclude,
    });
  });

  return toAdminOrderResponse(updatedOrder);
};
