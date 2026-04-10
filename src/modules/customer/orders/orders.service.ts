import prisma from '../../../config/prisma';

export const getMyOrders = async (customerId: string) => {
  return prisma.order.findMany({
    where: { customerId },
    include: {
      items: true,
      shippingAssignment: {
        include: {
          shift: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};
