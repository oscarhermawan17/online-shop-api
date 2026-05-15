/**
 * In-app notification utility
 *
 * All functions are fire-and-forget — errors are logged but never thrown,
 * so a notification failure never crashes the main request.
 *
 * One notification row per order per recipientRole (admin or customer).
 * On each status change the row is upserted: message updated, isRead reset to false.
 */

import prisma from "../config/prisma"
import { RecipientRole } from "@prisma/client"

// ─── Core upsert ─────────────────────────────────────────────────────────────

interface UpsertNotificationInput {
  storeId: string
  orderId: string
  recipientRole: RecipientRole
  message: string
  customerId?: string | null
}

const upsertNotification = async (
  input: UpsertNotificationInput,
): Promise<void> => {
  await prisma.notification.upsert({
    where: {
      orderId_recipientRole: {
        orderId: input.orderId,
        recipientRole: input.recipientRole,
      },
    },
    update: {
      message: input.message,
      isRead: false,
    },
    create: {
      storeId: input.storeId,
      orderId: input.orderId,
      recipientRole: input.recipientRole,
      message: input.message,
      customerId: input.customerId ?? null,
      isRead: false,
    },
  })
}

// ─── Trigger functions ────────────────────────────────────────────────────────

export const notifyCustomerOrderPlaced = (
  storeId: string,
  orderId: string,
  publicOrderId: string,
  customerId: string,
): void => {
  void upsertNotification({
    storeId,
    orderId,
    customerId,
    recipientRole: "customer",
    message: `Pesanan #${publicOrderId} berhasil dibuat. Silakan selesaikan pembayaran.`,
  }).catch((err) =>
    console.error("[Notification] notifyCustomerOrderPlaced:", err),
  )
}

export const notifyAdminNewOrder = (
  storeId: string,
  orderId: string,
  publicOrderId: string,
  customerName: string,
): void => {
  void upsertNotification({
    storeId,
    orderId,
    recipientRole: "admin",
    message: `Pesanan baru #${publicOrderId} dari ${customerName}.`,
  }).catch((err) => console.error("[Notification] notifyAdminNewOrder:", err))
}

export const notifyAdminPaymentProof = (
  storeId: string,
  orderId: string,
  publicOrderId: string,
): void => {
  void upsertNotification({
    storeId,
    orderId,
    recipientRole: "admin",
    message: `Bukti bayar pesanan #${publicOrderId} telah diupload. Silakan konfirmasi.`,
  }).catch((err) =>
    console.error("[Notification] notifyAdminPaymentProof:", err),
  )
}

export const notifyCustomerPaymentConfirmed = (
  storeId: string,
  orderId: string,
  publicOrderId: string,
  customerId: string,
): void => {
  void upsertNotification({
    storeId,
    orderId,
    customerId,
    recipientRole: "customer",
    message: `Pembayaran pesanan #${publicOrderId} dikonfirmasi. Pesanan sedang diproses.`,
  }).catch((err) =>
    console.error("[Notification] notifyCustomerPaymentConfirmed:", err),
  )
}

export const notifyCustomerOrderShipped = (
  storeId: string,
  orderId: string,
  publicOrderId: string,
  customerId: string,
  driverName: string,
): void => {
  void upsertNotification({
    storeId,
    orderId,
    customerId,
    recipientRole: "customer",
    message: `Pesanan #${publicOrderId} sedang dikirim oleh ${driverName}.`,
  }).catch((err) =>
    console.error("[Notification] notifyCustomerOrderShipped:", err),
  )
}

export const notifyCustomerOrderDone = (
  storeId: string,
  orderId: string,
  publicOrderId: string,
  customerId: string,
): void => {
  void upsertNotification({
    storeId,
    orderId,
    customerId,
    recipientRole: "customer",
    message: `Pesanan #${publicOrderId} selesai. Terima kasih sudah berbelanja!`,
  }).catch((err) =>
    console.error("[Notification] notifyCustomerOrderDone:", err),
  )
}

export const notifyCustomerOrderExpired = (
  storeId: string,
  orderId: string,
  publicOrderId: string,
  customerId: string,
): void => {
  void upsertNotification({
    storeId,
    orderId,
    customerId,
    recipientRole: "customer",
    message: `Pesanan #${publicOrderId} dibatalkan karena belum dibayar.`,
  }).catch((err) =>
    console.error("[Notification] notifyCustomerOrderExpired:", err),
  )
}

export const notifyAdminDeliveryOverdue = (
  storeId: string,
  orderId: string,
  publicOrderId: string,
  customerName: string,
  driverName: string,
): void => {
  void upsertNotification({
    storeId,
    orderId,
    recipientRole: "admin",
    message: `Pengiriman order #${publicOrderId} (${customerName}) belum selesai setelah 48 jam. Kurir: ${driverName}.`,
  }).catch((err) =>
    console.error("[Notification] notifyAdminDeliveryOverdue:", err),
  )
}
