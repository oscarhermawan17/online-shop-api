import { OrderComplaintStatus, Prisma } from '@prisma/client';

import prisma from '../../../config/prisma';
import { AppError } from '../../../middlewares/error.middleware';
import { populateVariantDescriptions } from '../../../utils/order-item';

const OPEN_COMPLAINT_STATUSES: OrderComplaintStatus[] = ['open', 'accepted'];

const customerOrderInclude = {
  items: true,
  paymentProof: true,
  complaints: {
    orderBy: {
      createdAt: 'desc',
    },
  },
  shippingAssignment: {
    include: { shift: true },
  },
} as const;

const parseEvidenceImageUrls = (value: Prisma.JsonValue): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
};

const toCustomerOrderResponse = <T extends { complaints: Array<{ evidenceImageUrls: Prisma.JsonValue }> }>(order: T) => ({
  ...order,
  complaints: order.complaints.map((complaint) => ({
    ...complaint,
    evidenceImageUrls: parseEvidenceImageUrls(complaint.evidenceImageUrls),
  })),
});

export const getMyOrders = async (customerId: string) => {
  const orders = await prisma.order.findMany({
    where: { customerId },
    include: customerOrderInclude,
    orderBy: { createdAt: 'desc' },
  });

  const allItems = await populateVariantDescriptions(orders.flatMap((o) => o.items));
  const itemMap = new Map(allItems.map((item) => [item.id, item]));

  return orders.map((order) => toCustomerOrderResponse({
    ...order,
    items: order.items.map((item) => itemMap.get(item.id) ?? item),
  }));
};

export const completeOrder = async (customerId: string, orderId: string) => {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerId,
    },
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
    throw new AppError('Order tidak ditemukan', 404);
  }

  if (order.status !== 'shipped' && order.status !== 'done') {
    throw new AppError('Order hanya bisa diselesaikan setelah dikirim', 400);
  }

  if (order.complaints.length > 0) {
    throw new AppError('Tidak bisa menyelesaikan pesanan saat komplain masih aktif', 400);
  }

  const updatedOrder = await prisma.order.update({
    where: {
      id: order.id,
    },
    data: {
      customerCompletedAt: order.customerCompletedAt ?? new Date(),
      status: order.adminCompletedAt ? 'done' : 'shipped',
    },
    include: customerOrderInclude,
  });

  const items = await populateVariantDescriptions(updatedOrder.items);

  return toCustomerOrderResponse({
    ...updatedOrder,
    items,
  });
};

export interface CreateOrderComplaintInput {
  comment: string;
  evidenceImageUrls: string[];
}

export const createOrderComplaint = async (
  customerId: string,
  orderId: string,
  input: CreateOrderComplaintInput,
) => {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerId,
    },
    select: {
      id: true,
      storeId: true,
      customerId: true,
      status: true,
      customerCompletedAt: true,
      adminCompletedAt: true,
    },
  });

  if (!order) {
    throw new AppError('Order tidak ditemukan', 404);
  }

  if (order.status !== 'shipped') {
    throw new AppError('Komplain hanya bisa dibuat pada order berstatus dikirim', 400);
  }

  if (order.customerCompletedAt || order.adminCompletedAt) {
    throw new AppError('Order yang sudah dikonfirmasi selesai tidak bisa dikomplain', 400);
  }

  const comment = input.comment.trim();
  if (!comment) {
    throw new AppError('Komentar komplain wajib diisi', 400);
  }

  const evidenceImageUrls = input.evidenceImageUrls
    .map((url) => url.trim())
    .filter((url) => Boolean(url));

  if (evidenceImageUrls.length === 0) {
    throw new AppError('Minimal satu bukti gambar wajib diunggah', 400);
  }

  if (evidenceImageUrls.length > 10) {
    throw new AppError('Maksimal 10 bukti gambar per komplain', 400);
  }

  const complaint = await prisma.orderComplaint.create({
    data: {
      storeId: order.storeId,
      orderId: order.id,
      customerId: order.customerId,
      comment,
      evidenceImageUrls,
      status: 'open',
    },
  });

  return {
    ...complaint,
    evidenceImageUrls,
  };
};
