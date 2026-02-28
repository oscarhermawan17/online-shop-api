# Prisma Seeder Prompt — Fashion Variant-Based Store

You are a senior backend engineer.

Generate a Prisma seed script for a fashion-based online shop using the following schema assumptions.

---

## System Supports

* Store
* Product
* ProductImage (optional)
* ProductOption (Color, Size)
* ProductOptionValue
* Variant
* VariantOptionValue

---

## Seeder Requirements

Create realistic fashion store seed data.

---

## 1. Store

Create **1 Store**:

**Name:** Urban Outfit Local

Include:

* whatsappNumber
* email
* address
* bankAccountName
* bankAccountNumber
* bankName

---

## 2. Products

Create **8 products** with mix of:

### Products WITH Variants

#### Sneakers

* Options:

  * Size → 39, 40, 41
  * Color → Hitam, Putih
* Some variants override price
* Some use basePrice

#### Hoodie

* Options:

  * Size → M, L
  * Color → Hitam, Abu

#### Jacket

* Options:

  * Size → M, L, XL
  * Color → Hijau, Hitam

#### T-Shirt

* Options:

  * Size → S, M, L
* No color option

---

### Products WITHOUT Variants

These products must:

* Have **NO options**
* Have **NO variants**
* Use only **basePrice**

Products:

* Cap (Topi)
* Sling Bag
* Leather Belt
* Beanie

---

## 3. Pricing Logic

Each product must have:

* basePrice

Variants:

* Some have `priceOverride`
* Some have `null` (fallback to basePrice)

---

## 4. Stock

Each variant must include:

Stock range: **3–15**

---

## 5. Images

* Some products have **1–2 ProductImage**
* Some products intentionally have **NONE**

(Gallery is optional)

---

## 6. SKU

SKU is:

* Optional only
* Do NOT require it in all variants

---

## 7. Data Relationships

Seeder must correctly:

* Create ProductOptions per product
* Create ProductOptionValues
* Link Variants via VariantOptionValue
* Ensure relational integrity

---

## 8. Seeder Output

Return a complete Prisma seed script:

* TypeScript
* Using Prisma Client
* Clean structure
* Use `createMany` where possible
* Use nested writes where appropriate

Script must be runnable via:

```bash
npx prisma db seed
```

---

## 9. Make Data Realistic

Use fashion-style product names like:

* Urban Basic Hoodie
* StreetFlex Sneakers
* Daily Comfort Tee
* Explorer Jacket
* Classic Cap

---

## Goal

Seeder must simulate real fashion store inventory with variant logic properly represented.
