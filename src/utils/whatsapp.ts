/**
 * Fonnte WhatsApp notification utility
 *
 * Docs: https://docs.fonnte.com/send-whatsapp-message-with-php-api/
 * All messages are fire-and-forget — errors are logged but never thrown,
 * so a WA failure never crashes the main request.
 *
 * Config is read from the Store record in the database (fonnteEnabled,
 * fonnteToken, adminWhatsapp). A 60-second in-memory cache prevents a DB
 * hit on every notification send.
 */

import prisma from "../config/prisma"

const FONNTE_API = "https://api.fonnte.com/send"
const CACHE_TTL_MS = 60_000

// ─── Config cache ─────────────────────────────────────────────────────────────

interface WAConfig {
  enabled: boolean
  token: string | null
  adminWhatsapp: string | null
}

const configCache = new Map<string, { config: WAConfig; expiresAt: number }>()

const getWAConfig = async (storeId: string): Promise<WAConfig> => {
  const cached = configCache.get(storeId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { fonnteEnabled: true, fonnteToken: true, adminWhatsapp: true },
  })

  const config: WAConfig = {
    enabled: store?.fonnteEnabled ?? false,
    token: store?.fonnteToken ?? null,
    adminWhatsapp: store?.adminWhatsapp ?? null,
  }

  configCache.set(storeId, { config, expiresAt: Date.now() + CACHE_TTL_MS })
  return config
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalizes Indonesian phone numbers to international format.
 * 08xx → 628xx, +628xx → 628xx
 */
const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("0")) return `62${digits.slice(1)}`
  if (digits.startsWith("62")) return digits
  return digits
}

// ─── Core send function ───────────────────────────────────────────────────────

const sendWhatsApp = async (
  storeId: string,
  target: string,
  message: string,
): Promise<void> => {
  const { enabled, token } = await getWAConfig(storeId)

  if (!enabled || !token) {
    console.log(`[WA disabled] → ${target}: ${message.slice(0, 60)}...`)
    return
  }

  try {
    // Fonnte API uses multipart/form-data (per official docs)
    const form = new FormData()
    form.append("target", normalizePhone(target))
    form.append("message", message)
    form.append("countryCode", "62")

    const res = await fetch(FONNTE_API, {
      method: "POST",
      headers: {
        Authorization: token,
      },
      body: form,
    })

    const data = (await res.json()) as { status: boolean; message?: string }

    if (!data.status) {
      console.error(`[WA] Failed to send to ${target}:`, data.message)
    }
  } catch (error) {
    // Never throw — WA failure must not crash the main flow
    console.error(`[WA] Error sending to ${target}:`, error)
  }
}

// ─── Notification templates ───────────────────────────────────────────────────

export const notifyOrderPlaced = async (
  storeId: string,
  customerPhone: string,
  customerName: string,
  publicOrderId: string,
  totalAmount: number,
  storeName: string,
) => {
  const message =
    `Halo ${customerName}! 👋\n\n` +
    `Pesanan kamu *${publicOrderId}* sudah kami terima.\n` +
    `Total: *Rp ${totalAmount.toLocaleString("id-ID")}*\n\n` +
    `Silakan selesaikan pembayaran sebelum waktu habis.\n` +
    `Terima kasih sudah belanja di *${storeName}*! 🙏`

  await sendWhatsApp(storeId, customerPhone, message)
}

export const notifyAdminNewOrder = async (
  storeId: string,
  publicOrderId: string,
  customerName: string,
  totalAmount: number,
) => {
  const { adminWhatsapp } = await getWAConfig(storeId)
  if (!adminWhatsapp) return

  const message =
    `🛒 *Pesanan Baru!*\n\n` +
    `Order: *#${publicOrderId}*\n` +
    `Pelanggan: ${customerName}\n` +
    `Total: *Rp ${totalAmount.toLocaleString("id-ID")}*\n\n` +
    `Cek dashboard untuk detail.`

  await sendWhatsApp(storeId, adminWhatsapp, message)
}

export const notifyAdminDeliveryOverdue = async (
  storeId: string,
  publicOrderId: string,
  customerName: string,
  customerAddress: string,
  driverName: string,
  assignedAt: Date,
): Promise<void> => {
  const { adminWhatsapp } = await getWAConfig(storeId)
  if (!adminWhatsapp) return

  const assignedDate = assignedAt.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const message =
    `⚠️ *Pengiriman Belum Selesai*\n\n` +
    `Order: *#${publicOrderId}*\n` +
    `Customer: ${customerName}\n` +
    `Alamat: ${customerAddress}\n` +
    `Kurir: ${driverName}\n` +
    `Dikirim: ${assignedDate}\n\n` +
    `Order belum selesai setelah 48 jam. Tolong segera tindak lanjuti.`

  await sendWhatsApp(storeId, adminWhatsapp, message)
}

export const notifyAdminComplaint = async (
  storeId: string,
  publicOrderId: string,
  customerName: string,
  customerAddress: string,
  driverName: string,
  complaintComment: string,
): Promise<void> => {
  const { adminWhatsapp } = await getWAConfig(storeId)
  if (!adminWhatsapp) return

  const message =
    `📢 *Komplain Baru Masuk*\n\n` +
    `Order: *#${publicOrderId}*\n` +
    `Customer: ${customerName}\n` +
    `Alamat: ${customerAddress}\n` +
    `Kurir: ${driverName}\n` +
    `Komplain: ${complaintComment}\n\n` +
    `Segera periksa di dashboard.`

  await sendWhatsApp(storeId, adminWhatsapp, message)
}
