import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// ─── Helper: Product with options & variants ──────────────────────────────────
async function createProductWithVariants(data: {
  storeId: string
  name: string
  description: string
  basePrice: number
  images?: string[]
  options: { name: string; values: string[] }[]
  variants: {
    optionValues: Record<string, string>
    priceOverride?: number
    stock: number
  }[]
}) {
  const product = await prisma.product.create({
    data: {
      storeId: data.storeId,
      name: data.name,
      description: data.description,
      basePrice: data.basePrice,
      ...(data.images?.length
        ? {
            images: {
              createMany: {
                data: data.images.map((url) => ({
                  storeId: data.storeId,
                  imageUrl: url,
                })),
              },
            },
          }
        : {}),
    },
  })

  // Create options & values, build lookup map: optionName → { value → id }
  const optionMap: Record<string, Record<string, string>> = {}

  for (const opt of data.options) {
    const option = await prisma.productOption.create({
      data: {
        storeId: data.storeId,
        productId: product.id,
        name: opt.name,
        values: {
          createMany: {
            data: opt.values.map((v) => ({ storeId: data.storeId, value: v })),
          },
        },
      },
      include: { values: true },
    })

    optionMap[opt.name] = {}
    for (const val of option.values) {
      optionMap[opt.name][val.value] = val.id
    }
  }

  // Create variants and link to option values
  for (const v of data.variants) {
    const variant = await prisma.variant.create({
      data: {
        storeId: data.storeId,
        productId: product.id,
        isDefault: false,
        priceOverride: v.priceOverride ?? null,
        stock: v.stock,
      },
    })

    await prisma.variantOptionValue.createMany({
      data: Object.entries(v.optionValues).map(([optName, optValue]) => ({
        variantId: variant.id,
        optionValueId: optionMap[optName][optValue],
      })),
    })
  }

  return product
}

// ─── Helper: Simple product (no options — uses a default variant for stock) ────
async function createSimpleProduct(data: {
  storeId: string
  name: string
  description: string
  basePrice: number
  stock: number
  images?: string[]
}) {
  return prisma.product.create({
    data: {
      storeId: data.storeId,
      name: data.name,
      description: data.description,
      basePrice: data.basePrice,
      variants: {
        create: { storeId: data.storeId, isDefault: true, stock: data.stock },
      },
      ...(data.images?.length
        ? {
            images: {
              createMany: {
                data: data.images.map((url) => ({
                  storeId: data.storeId,
                  imageUrl: url,
                })),
              },
            },
          }
        : {}),
    },
  })
}

// Static store ID — never changes across reseeds or DB resets
const STORE_ID = process.env.STORE_ID_DEFAULT ?? 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

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
      bankAccountName: "Urban Outfit Local",
      bankAccountNumber: "1234567890",
      bankName: "BCA",
      deliveryRetailMinimumOrder: 50000,
      deliveryStoreMinimumOrder: 100000,
      deliveryRetailFreeShippingMinimumOrder: 200000,
      deliveryStoreFreeShippingMinimumOrder: 300000,
    },
  })
  console.log(`✅ Store upserted: ${store.name} (id: ${store.id})`)

  const hasProducts = await prisma.product.count({
    where: { storeId: STORE_ID },
  })
  if (hasProducts === 0) {
    // ── 1. StreetFlex Sneakers (Size × Color) ──────────────────────────────────
    await createProductWithVariants({
      storeId: STORE_ID,
      name: "StreetFlex Sneakers",
      description:
        "Sneakers kasual dengan sol ringan dan desain urban yang stylish.",
      basePrice: 350000,
      images: [
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600",
        "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600",
      ],
      options: [
        { name: "Size", values: ["39", "40", "41"] },
        { name: "Color", values: ["Hitam", "Putih"] },
      ],
      variants: [
        { optionValues: { Size: "39", Color: "Hitam" }, stock: 10 },
        {
          optionValues: { Size: "39", Color: "Putih" },
          stock: 8,
          priceOverride: 365000,
        },
        { optionValues: { Size: "40", Color: "Hitam" }, stock: 12 },
        {
          optionValues: { Size: "40", Color: "Putih" },
          stock: 9,
          priceOverride: 365000,
        },
        { optionValues: { Size: "41", Color: "Hitam" }, stock: 6 },
        {
          optionValues: { Size: "41", Color: "Putih" },
          stock: 5,
          priceOverride: 380000,
        },
      ],
    })
    console.log("✅ StreetFlex Sneakers created (6 variants)")

    // ── 2. Urban Basic Hoodie (Size × Color) ───────────────────────────────────
    await createProductWithVariants({
      storeId: STORE_ID,
      name: "Urban Basic Hoodie",
      description:
        "Hoodie bahan fleece tebal, cocok untuk cuaca dingin maupun santai sehari-hari.",
      basePrice: 280000,
      images: [
        "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=600",
      ],
      options: [
        { name: "Size", values: ["M", "L"] },
        { name: "Color", values: ["Hitam", "Abu"] },
      ],
      variants: [
        { optionValues: { Size: "M", Color: "Hitam" }, stock: 15 },
        {
          optionValues: { Size: "M", Color: "Abu" },
          stock: 12,
          priceOverride: 290000,
        },
        { optionValues: { Size: "L", Color: "Hitam" }, stock: 10 },
        {
          optionValues: { Size: "L", Color: "Abu" },
          stock: 8,
          priceOverride: 295000,
        },
      ],
    })
    console.log("✅ Urban Basic Hoodie created (4 variants)")

    // ── 3. Explorer Jacket (Size × Color) ─────────────────────────────────────
    await createProductWithVariants({
      storeId: STORE_ID,
      name: "Explorer Jacket",
      description:
        "Jaket outdoor anti-angin dengan desain modern, cocok untuk aktivitas luar ruangan.",
      basePrice: 450000,
      // intentionally no images
      options: [
        { name: "Size", values: ["M", "L", "XL"] },
        { name: "Color", values: ["Hijau", "Hitam"] },
      ],
      variants: [
        { optionValues: { Size: "M", Color: "Hijau" }, stock: 7 },
        { optionValues: { Size: "M", Color: "Hitam" }, stock: 9 },
        { optionValues: { Size: "L", Color: "Hijau" }, stock: 6 },
        {
          optionValues: { Size: "L", Color: "Hitam" },
          stock: 11,
          priceOverride: 470000,
        },
        {
          optionValues: { Size: "XL", Color: "Hijau" },
          stock: 4,
          priceOverride: 480000,
        },
        {
          optionValues: { Size: "XL", Color: "Hitam" },
          stock: 5,
          priceOverride: 480000,
        },
      ],
    })
    console.log("✅ Explorer Jacket created (6 variants)")

    // ── 4. Daily Comfort Tee (Size only) ──────────────────────────────────────
    await createProductWithVariants({
      storeId: STORE_ID,
      name: "Daily Comfort Tee",
      description:
        "Kaos katun premium nyaman untuk aktivitas harian. Tersedia dalam berbagai ukuran.",
      basePrice: 120000,
      images: [
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600",
      ],
      options: [{ name: "Size", values: ["S", "M", "L"] }],
      variants: [
        { optionValues: { Size: "S" }, stock: 14 },
        { optionValues: { Size: "M" }, stock: 15 },
        { optionValues: { Size: "L" }, stock: 13 },
      ],
    })
    console.log("✅ Daily Comfort Tee created (3 variants)")

    // ── 5. Classic Cap (no variants) ──────────────────────────────────────────
    await createSimpleProduct({
      storeId: STORE_ID,
      name: "Classic Cap",
      description:
        "Topi snapback kasual dengan bordir logo minimalis, one size fits all.",
      basePrice: 85000,
      stock: 20,
      images: [
        "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600",
      ],
    })
    console.log("✅ Classic Cap created")

    // ── 6. Urban Sling Bag (no variants) ──────────────────────────────────────
    await createSimpleProduct({
      storeId: STORE_ID,
      name: "Urban Sling Bag",
      description:
        "Tas selempang anti-air kapasitas 5L, ringan dan cocok untuk daily use.",
      basePrice: 175000,
      stock: 15,
    })
    console.log("✅ Urban Sling Bag created")

    // ── 7. Leather Belt (no variants) ─────────────────────────────────────────
    await createSimpleProduct({
      storeId: STORE_ID,
      name: "Leather Belt",
      description:
        "Ikat pinggang kulit sintetis premium dengan buckle silver klasik.",
      basePrice: 95000,
      stock: 25,
      images: [
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600",
      ],
    })
    console.log("✅ Leather Belt created")

    // ── 8. Cozy Beanie (no variants) ──────────────────────────────────────────
    await createSimpleProduct({
      storeId: STORE_ID,
      name: "Cozy Beanie",
      description:
        "Kupluk rajut hangat untuk musim hujan, tersedia dalam warna netral.",
      basePrice: 65000,
      stock: 30,
    })
    console.log("✅ Cozy Beanie created")
  } // end if (hasProducts === 0)

  // ── Default Admin ────────────────────────────────────────────────────────
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD ?? "password"
  const hashedPassword = await bcrypt.hash(adminPassword, 10)
  const admin = await prisma.admin.upsert({
    where: { phone: "628111111111" },
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

  // ─── Seed Customers ───────────────────────────────────────────────────────────
  const customerPassword = process.env.CUSTOMER_DEFAULT_PASSWORD ?? "password"
  const hasedcustomerPassword = await bcrypt.hash(customerPassword, 10)

  const customerData = [
    { name: "Testing", phone: "6281", email: "testing@example.com" },
    { name: "Budi Santoso", phone: "6281100000001", email: "budi@example.com" },
    { name: "Sari Dewi", phone: "6281100000002", email: "sari@example.com" },
    { name: "Ahmad Fauzi", phone: "6281100000003", email: null },
    {
      name: "Rina Wulandari",
      phone: "6281100000004",
      email: "rina@example.com",
    },
    { name: "Doni Prasetyo", phone: "6281100000005", email: null },
    { name: "Maya Kusuma", phone: "6281100000006", email: "maya@example.com" },
    { name: "Hendra Gunawan", phone: "6281100000007", email: null },
    {
      name: "Fitri Rahayu",
      phone: "6281100000008",
      email: "fitri@example.com",
    },
    { name: "Rizky Aditya", phone: "6281100000009", email: null },
    { name: "Nur Hidayah", phone: "6281100000010", email: "nur@example.com" },
  ]

  for (const c of customerData) {
    await prisma.customer.upsert({
      where: { storeId_phone: { storeId: STORE_ID, phone: c.phone } },
      update: {},
      create: {
        storeId: STORE_ID,
        name: c.name,
        phone: c.phone,
        email: c.email,
        password: hasedcustomerPassword,
      },
    })
  }
  console.log("✅ 10 customers seeded (password: password123!)")

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
