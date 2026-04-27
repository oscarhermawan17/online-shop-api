import prisma from '../../../config/prisma';
import { populateVariantDescriptions } from '../../../utils/order-item';

export const getMyOrders = async (customerId: string) => {
  const orders = await prisma.order.findMany({
    where: { customerId },
    include: {
      items: true,
      paymentProof: true,
      shippingAssignment: {
        include: { shift: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const allItems = await populateVariantDescriptions(orders.flatMap((o) => o.items));
  const itemMap = new Map(allItems.map((item) => [item.id, item]));

  return orders.map((order) => ({
    ...order,
    items: order.items.map((item) => itemMap.get(item.id) ?? item),
  }));
};
