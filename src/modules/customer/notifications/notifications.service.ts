import prisma from "../../../config/prisma"

const PAGE_SIZE = 20

export const getMyNotifications = async (customerId: string, page = 1) => {
  const skip = (page - 1) * PAGE_SIZE
  const where = { customerId, recipientRole: "customer" as const }

  const [notifications, totalCount, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        order: {
          select: { publicOrderId: true, status: true },
        },
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, isRead: false } }),
  ])

  return {
    notifications,
    unreadCount,
    totalCount,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
    page,
  }
}

export const markAllRead = async (customerId: string) => {
  await prisma.notification.updateMany({
    where: { customerId, recipientRole: "customer", isRead: false },
    data: { isRead: true },
  })
}
