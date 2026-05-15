import cron from "node-cron"
import prisma from "../config/prisma"
import { restoreOrderStock } from "../utils/order-stock"
import { notifyCustomerOrderExpired } from "../utils/notifications"
import { notifyOrderExpired as notifyOrderExpiredWA } from "../utils/whatsapp"

/**
 * Interval controlled by ORDER_EXPIRY_CRON_MINUTES env var (default: 5).
 * Finds all pending_payment orders past their expiresAt,
 * restores variant stock (with StockMovement records), and
 * marks them as expired_unpaid.
 */
export const startExpireOrdersJob = () => {
  const minutes = parseInt(process.env.ORDER_EXPIRY_CRON_MINUTES ?? "5", 10)
  const schedule = `*/${minutes} * * * *`

  cron.schedule(schedule, async () => {
    try {
      const expiredOrders = await prisma.order.findMany({
        where: {
          status: "pending_payment",
          expiresAt: { lt: new Date() },
        },
        select: {
          id: true,
          storeId: true,
          customerId: true,
          publicOrderId: true,
          items: {
            select: {
              variantId: true,
              quantity: true,
            },
          },
        },
      })

      if (expiredOrders.length === 0) return

      console.log(`⏰ Expiring ${expiredOrders.length} unpaid order(s)...`)

      for (const order of expiredOrders) {
        await prisma.$transaction(async (tx) => {
          // Restore stock + create StockMovement records
          await restoreOrderStock(tx, {
            storeId: order.storeId,
            orderId: order.id,
            items: order.items,
            notes: "Order expired — stock restored by cron job",
          })

          // Mark order as expired
          await tx.order.update({
            where: { id: order.id },
            data: { status: "expired_unpaid" },
          })
        })

        notifyCustomerOrderExpired(
          order.storeId,
          order.id,
          order.publicOrderId,
          order.customerId,
        )

        // WA notification — fire-and-forget, fetch customer+store data async
        void (async () => {
          try {
            const [customer, store] = await Promise.all([
              prisma.customer.findUnique({
                where: { id: order.customerId },
                select: { phone: true, name: true },
              }),
              prisma.store.findUnique({
                where: { id: order.storeId },
                select: { name: true },
              }),
            ])
            if (customer && store) {
              void notifyOrderExpiredWA(
                order.storeId,
                customer.phone,
                customer.name ?? "Pelanggan",
                order.publicOrderId,
                store.name,
              )
            }
          } catch {
            /* ignore */
          }
        })()

        console.log(`  ✓ Order ${order.id} expired`)
      }
    } catch (error) {
      console.error("❌ expire-orders job failed:", error)
    }
  })

  console.log(`⏰ expire-orders cron job started (every ${minutes} minutes)`)
}
