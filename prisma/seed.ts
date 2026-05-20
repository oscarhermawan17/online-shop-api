import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// Static store ID — never changes across reseeds or DB resets
const STORE_ID =
  process.env.STORE_ID_DEFAULT ?? "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Starting seed...\n")

  // ── Store ──────────────────────────────────────────────────────────────────
  const store = await prisma.store.upsert({
    where: { id: STORE_ID },
    update: {},
    create: {
      id: STORE_ID,
      name: "Urban Outfit Local",
      whatsappNumber: "628123456789",
      email: "hello@urbanoutfitlocal.id",
      address: "Jl. Sudirman No. 12, Jakarta Pusat, DKI Jakarta",
      deliveryRetailMinimumOrder: 50000,
      deliveryStoreMinimumOrder: 100000,
      deliveryRetailFreeShippingMinimumOrder: 200000,
      deliveryStoreFreeShippingMinimumOrder: 300000,
    },
  })
  console.log(`✅ Store upserted: ${store.name} (id: ${store.id})`)

  // ── Bank Accounts ──────────────────────────────────────────────────────────
  const hasBankAccounts = await prisma.storeBankAccount.count({
    where: { storeId: STORE_ID },
  })
  if (hasBankAccounts === 0) {
    await prisma.storeBankAccount.create({
      data: {
        storeId: STORE_ID,
        bankName: "BCA",
        accountNumber: "1234567890",
        accountHolder: "Urban Outfit Local",
        sortOrder: 0,
      },
    })
    console.log("✅ Default bank account seeded")
  }

  const hasCarouselSlides = await prisma.carouselSlide.count({
    where: { storeId: STORE_ID },
  })
  if (hasCarouselSlides === 0) {
    await prisma.carouselSlide.createMany({
      data: [
        {
          storeId: STORE_ID,
          title: "Grosir Minyak Goreng\nDiskon s/d 15%",
          subtitle: "Stok terbatas untuk kebutuhan restoran dan katering.",
          badge: "PROMO UNGGULAN",
          backgroundColor: "#166534",
          isActive: true,
          sortOrder: 0,
        },
        {
          storeId: STORE_ID,
          title: "Paket Sembako\nMurah & Hemat",
          subtitle: "Kebutuhan pokok harga grosir untuk UMKM dan rumah tangga.",
          badge: "HARGA TERBAIK",
          backgroundColor: "#006f1d",
          isActive: true,
          sortOrder: 1,
        },
        {
          storeId: STORE_ID,
          title: "Peralatan Rumah\nProduk Berkualitas",
          subtitle: "Lengkapi dapur Anda dengan peralatan standar resto.",
          badge: "CUCI GUDANG",
          backgroundColor: "#064e3b",
          isActive: true,
          sortOrder: 2,
        },
      ],
    })
    console.log("✅ Default carousel slides seeded")
  }

  // ── Default Admin ────────────────────────────────────────────────────────
  const adminPassword = "cakrawalaSHOP123!"
  const hashedPassword = await bcrypt.hash(adminPassword, 10)
  const admin = await prisma.admin.upsert({
    where: { storeId_phone: { storeId: STORE_ID, phone: "628111111111" } },
    update: {},
    create: {
      storeId: STORE_ID,
      name: "Owner UMKM",
      phone: "628111111111",
      email: "owner@urbanoutfitlocal.id",
      role: "owner",
      password: hashedPassword,
    },
  })
  console.log(`✅ Default admin upserted: ${admin.name} (${admin.email})`)

  console.log("\n🎉 Seed completed successfully!")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
