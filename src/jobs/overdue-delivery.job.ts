import cron from "node-cron"
import prisma from "../config/prisma"
import { notifyAdminDeliveryOverdue as notifyAdminDeliveryOverdueInApp } from "../utils/notifications"
import { notifyAdminDeliveryOverdue as notifyAdminDeliveryOverdueWA } from "../utils/whatsapp"

const OVERDUE_HOURS = 48

/**
 * Runs every hour. Finds shipped delivery orders where:
 * - deliveryMethod = "delivery" (skip pickup orders)
 * - assignedAt is more than 48h ago
 * - order is still in "shipped" status (not yet done)
 * - overdueNotifiedAt is null (only notify once)
 *
 * Sends WA to admin and marks overdueNotifiedAt so it won't fire again.
 */
export const startOverdueDeliveryJob = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const cutoff = new Date(Date.now() - OVERDUE_HOURS * 60 * 60 * 1000)

      const overdueAssignments = await prisma.orderShippingAssignment.findMany({
        where: {
          overdueNotifiedAt: null,
          assignedAt: { lt: cutoff },
          order: {
            status: "shipped",
            deliveryMethod: "delivery",
          },
        },
        select: {
          id: true,
          orderId: true,
          driverName: true,
          assignedAt: true,
          order: {
            select: {
              storeId: true,
              publicOrderId: true,
              customerName: true,
              customerAddress: true,
            },
          },
        },
      })

      if (overdueAssignments.length === 0) return

      console.log(
        `⚠️  overdue-delivery: ${overdueAssignments.length} overdue order(s)`,
      )

      for (const assignment of overdueAssignments) {
        const { order } = assignment

        // Mark as notified first to avoid double-send on error
        await prisma.orderShippingAssignment.update({
          where: { id: assignment.id },
          data: { overdueNotifiedAt: new Date() },
        })

        void notifyAdminDeliveryOverdueWA(
          order.storeId,
          order.publicOrderId,
          order.customerName ?? "—",
          order.customerAddress ?? "—",
          assignment.driverName,
          assignment.assignedAt,
        )

        notifyAdminDeliveryOverdueInApp(
          order.storeId,
          assignment.orderId,
          order.publicOrderId,
          order.customerName ?? "—",
          assignment.driverName,
        )

        console.log(`  ✓ Notified overdue order #${order.publicOrderId}`)
      }
    } catch (error) {
      console.error("❌ overdue-delivery job failed:", error)
    }
  })

  console.log(
    `⚠️  overdue-delivery cron job started (every hour, ${OVERDUE_HOURS}h threshold)`,
  )
}
