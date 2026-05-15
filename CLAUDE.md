# online-shop-api — Claude Context

## Stack

- Node.js + Express v5 + TypeScript + Prisma ORM
- Database: Supabase (PostgreSQL) for prod; Docker PostgreSQL for stg
- Port: **4000** (prod) / **8000** (stg)
- Structure: `src/modules/{public,customer,admin}/` + `src/middlewares/` + `src/utils/`

---

## Database (.env)

Only `DATABASE_URL` is used — no `DIRECT_URL`.

### Prod (Supabase cloud)

```
# For dev & production (pooler port 6543) — works on Biznet WiFi
DATABASE_URL=postgresql://postgres.xceemlzendhddaghwerv:...@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true

# For db push & seed (direct port 5432) — works on Telkomsel only (Biznet blocks 5432)
# DATABASE_URL=postgresql://postgres:...@db.xceemlzendhddaghwerv.supabase.co:5432/postgres
```

**Push/seed workflow (prod):** switch to Telkomsel → uncomment direct URL → run push/seed → switch back to pooler.

### Stg (local Docker postgres)

Stg uses a local PostgreSQL container. No network switching needed.

```bash
# From local-stg/ (docker compose must be running)
docker compose exec api-stg npx prisma db push
docker compose exec api-stg npm run prisma:seed

# Fresh reset:
docker compose down -v && docker compose up -d
docker compose exec api-stg npx prisma db push
docker compose exec api-stg npm run prisma:seed
```

Stg `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/online_shop_stg` (internal Docker hostname).

Commands:

- Reset DB: `npx prisma db push --force-reset`
- Seed: `npm run prisma:seed`

Seed uses static `STORE_ID = process.env.STORE_ID_DEFAULT ?? 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'`

---

## Multi-Tenant Architecture

- **Chosen approach: separate identity tables (Option A)** — not a single users table with roles
- Every tenant table has `storeId` — already complete, nothing needs to be added
- 3 identity types, each a separate table with its own auth flow:

| Table        | storeId     | Auth endpoint                | Status                 |
| ------------ | ----------- | ---------------------------- | ---------------------- |
| `Superadmin` | ❌ none     | `/api/superadmin/auth/login` | Future — not built yet |
| `Admin`      | ✅ required | `/api/auth/login`            | Done                   |
| `Customer`   | ✅ required | `/api/customer-auth/login`   | Done                   |

- Models correctly WITHOUT storeId: `Store` (is the tenant), `HealthCheck` (not tenant data), `VariantOptionValue` (pure join table, inherits scope via Variant)
- When superadmin is needed: add a new `Superadmin` model + new middleware — zero changes to existing admin/customer code

---

## All Models (schema.prisma)

All models have `storeId` except Store, HealthCheck, and VariantOptionValue (intentional — see above).

| Model                   | Purpose                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Store                   | Tenant config (QRIS, minimum orders, free shipping thresholds) — bank accounts are in StoreBankAccount                                                                           |
| StoreBankAccount        | Multiple bank accounts per store; fields: bankName (BankName enum), accountNumber, accountHolder, sortOrder; onDelete Cascade from Store                                         |
| Admin                   | Admin accounts; roles: owner / manager / staff                                                                                                                                   |
| Customer                | Store-scoped customers; password nullable (guest); `type`: base (guest pricing) or wholesale (retail pricing); `avatarUrl` nullable                                              |
| CustomerAddress         | Saved delivery addresses with optional GPS coords                                                                                                                                |
| Product                 | Has basePrice + wholesalePrice; optional unitId + categories (many-to-many)                                                                                                      |
| ProductImage            | Gallery images                                                                                                                                                                   |
| ProductOption           | Option types (e.g. "Size", "Color")                                                                                                                                              |
| ProductOptionValue      | Option values (e.g. "M", "Black")                                                                                                                                                |
| Variant                 | Sellable SKU; priceOverride, wholesalePriceOverride, stock, imageUrl                                                                                                             |
| VariantOptionValue      | Join: Variant ↔ ProductOptionValue                                                                                                                                               |
| VariantDiscountRule     | Per-variant discount rules: triggerType (quantity/line_subtotal), valueType (percentage/fixed_amount), applyMode (per_item/line_total), customerType filter, priority, isActive  |
| ProductDiscountRule     | Same structure as VariantDiscountRule but scoped to a product; can target specific variantIds via `targetVariantIds[]`                                                           |
| ProductDiscount         | Legacy simple discount: normalDiscount + normalDiscountActive (guest), retailDiscount + retailDiscountActive (ritel); startDate/endDate nullable                                 |
| Order                   | status enum, expiresAt (30mins for bank transfer; null for credit), paymentMethod, deliveryMethod, termOfPaymentSnapshot, adminCompletedAt, customerCompletedAt, creditSettledAt |
| OrderItem               | Price/name snapshot; discountAmount, discountRuleName, originalPrice for discount tracking                                                                                       |
| PaymentProof            | Bank transfer image upload                                                                                                                                                       |
| ShippingZone            | District → cost mapping                                                                                                                                                          |
| ShippingDriver          | Courier master list                                                                                                                                                              |
| ShippingShift           | Delivery shift templates                                                                                                                                                         |
| OrderShippingAssignment | Courier dispatch record per order                                                                                                                                                |
| OrderComplaint          | Customer complaint per order; evidenceImageUrls (JSON), status: open/accepted/rejected/resolved; admin lifecycle fields                                                          |
| StockMovement           | Ledger of every stock in/out event; category: initial_stock/add_stock/sale/restore; balanceAfter tracks running stock; linked to Admin, Product, Variant                         |
| CarouselSlide           | Promotional banner slides; title, subtitle, badge, imageUrl, backgroundColor, showText, isActive, sortOrder; max 10 per store                                                    |
| Category                | Product categories with icon; many-to-many with Product                                                                                                                          |
| Unit                    | Product unit of measure (e.g. pcs, kg); one-to-many with Product                                                                                                                 |
| CustomerCredit          | Per-customer credit limit + termOfPayment (days); admin-managed; one-to-one with Customer                                                                                        |
| CreditPayment           | Partial/full payment records against a credit order; many-to-one with Order                                                                                                      |
| CartItem                | Persistent cart per customer; `@@unique([customerId, productId, variantId])`; quantity clamped to variant stock on upsert                                                        |

---

## Deployment

- **Prod**: `ghcr.io/oscarhermawan17/online-shop-api:latest` — port 4000
- **Stg**: `ghcr.io/oscarhermawan17/online-shop-api:staging` — port 8000
- CI/CD: push to `main` → `:latest`, push to `stg` → `:staging`, auto-deploys to VPS
- CI/CD runs `npx prisma db push --accept-data-loss` before container starts (using new image + `--network umkm_default`)
- VPS path: `/home/ubuntu/umkm/docker-compose.yaml`

---

## All Endpoints

### Public (no auth)

```
GET  /api/health
GET  /api/store
GET  /api/products              (optional customer auth → wholesale pricing + discount rules)
GET  /api/products/:id
GET  /api/categories            (public category list)
GET  /api/carousel              (active slides only)
GET  /api/shipping-zones
POST /api/checkout              (optional customer auth)
POST /api/payment-proof
GET  /api/order/:publicOrderId
POST /api/auth/login            (admin login)
POST /api/customer-auth/login   (customer login)
```

### Customer (requireCustomerAuth)

```
GET    /api/customer/orders
PATCH  /api/customer/orders/:id/complete        (mark order as done by customer)
POST   /api/customer/orders/:id/complaints      (file complaint with comment + evidence images)
GET    /api/customer/addresses
POST   /api/customer/addresses
PATCH  /api/customer/addresses/:id
DELETE /api/customer/addresses/:id
GET    /api/customer/credit
GET    /api/customer/cart
POST   /api/customer/cart                       (add item)
POST   /api/customer/cart/merge                 (merge guest cart on login)
PUT    /api/customer/cart/:productId/:variantId  (set quantity)
DELETE /api/customer/cart/:productId/:variantId  (remove item)
DELETE /api/customer/cart                       (clear cart)
```

### Admin (requireAuth + requireRole)

```
# Store — manager+
GET   /api/admin/store
PATCH /api/admin/store
PUT   /api/admin/store/bank-accounts   (full replace of all bank accounts)

# Products — staff+
GET/POST                          /api/admin/products
GET                               /api/admin/products/export/inventory   (XLS export of all variant stock)
GET/PATCH/DELETE                  /api/admin/products/:id
POST/DELETE                       /api/admin/products/:id/images
POST/DELETE                       /api/admin/products/:id/images/:imageId
POST/DELETE                       /api/admin/products/:id/options
POST/DELETE                       /api/admin/products/:id/options/:optionId
POST                              /api/admin/products/:id/variants
PATCH/DELETE                      /api/admin/products/:id/variants/:variantId

# Variant Discount Rules — staff+
GET/POST                          /api/admin/products/:id/variants/:variantId/discount-rules
PATCH/DELETE                      /api/admin/products/:id/variants/:variantId/discount-rules/:ruleId

# Product Discount Rules — staff+
GET/POST                          /api/admin/products/:id/discount-rules
PATCH/DELETE                      /api/admin/products/:id/discount-rules/:ruleId

# Product Discount (legacy) — staff+
PUT                               /api/admin/products/:id/discount

# Inventory / Stock Movements — staff+
GET                               /api/admin/inventory            (?startDate, ?endDate, ?productId, ?variantId, ?category)
GET                               /api/admin/inventory/export     (same filters → XLS download)
POST                              /api/admin/inventory/add        (manual stock adjustment: variantId, quantity, notes, addedAt)

# Dashboard — staff+
GET                               /api/admin/dashboard            (?period=today|yesterday|this_month|last_month|custom, ?startDate, ?endDate)

# Customers — staff+
GET                               /api/admin/customers            (?page, ?limit=25|50|100, ?search, ?status=active|inactive)
POST                              /api/admin/customers
PATCH                             /api/admin/customers/:id/toggle-status
PATCH                             /api/admin/customers/:id/type   (update CustomerType: base | wholesale)

# Credit — staff+
GET                               /api/admin/credit
PUT                               /api/admin/credit/:customerId   (set creditLimit + termOfPayment)

# Receivables — staff+
GET                               /api/admin/receivables
POST                              /api/admin/receivables/:id/payments

# Orders — staff+
GET                               /api/admin/orders
GET                               /api/admin/orders/:id
PATCH                             /api/admin/orders/:id/confirm            (payment confirm → paid)
PATCH                             /api/admin/orders/:id/settle-credit      (mark credit order fully settled)
PATCH                             /api/admin/orders/:id/ship               (assign courier)
PATCH                             /api/admin/orders/:id/status             (manual status update)
PATCH                             /api/admin/orders/:id/complaints/:complaintId/status  (update complaint lifecycle)

# Shipping — manager+
GET/PUT/PATCH/DELETE              /api/admin/shipping-zones
GET/POST/PATCH/DELETE             /api/admin/shipping-drivers
GET/POST/PATCH/DELETE             /api/admin/shipping-shifts

# Carousel — manager+
GET/PUT                           /api/admin/carousel

# Categories — staff+
GET/POST/PATCH/DELETE             /api/admin/categories
GET                               /api/admin/categories/:id

# Units — staff+
GET/POST/PATCH/DELETE             /api/admin/units
GET                               /api/admin/units/:id
```

---

## Auth Middleware

- `requireAuth()` — validates admin JWT
- `requireRole(...roles)` — role hierarchy: owner ≥ manager ≥ staff
- `requireCustomerAuth()` — mandatory customer JWT
- `optionalCustomerAuth()` — guest-friendly (attaches customer if token present)

---

## Discount System (current)

Two systems coexist. The rule-based system (3.6/3.7) is newer and takes precedence at checkout.

### Rule-Based (VariantDiscountRule + ProductDiscountRule)

- **Trigger**: `quantity` (min/max units in cart) or `line_subtotal` (min/max subtotal for line)
- **Value**: `percentage` (%) or `fixed_amount` (Rp)
- **Apply**: `per_item` (discount per unit) or `line_total` (discount on total line)
- **Scope**: `customerType` = base | wholesale | null (both)
- **Priority**: higher number = evaluated first; first matching active rule wins
- Applied in `src/utils/variant-discount.ts` (used by checkout + public products)

### Legacy (ProductDiscount)

- Simple flat % per product for normal vs retail price
- Still functional; used if no rule-based discount applies

---

## Inventory / Stock Movement

Every stock change creates a `StockMovement` row:

- `initial_stock` — first stock set when variant created/seeded
- `add_stock` — manual admin adjustment via `POST /admin/inventory/add`
- `sale` — decremented at checkout (inside transaction)
- `restore` — restored on order expiry (pg_cron + lazy fallback)

`balanceAfter` = running stock total after each event. Used for audit/history views.
Export at `GET /admin/inventory/export` → `.xls` file via `src/utils/xls.ts`.

---

## Credit System

- `CustomerCredit.creditLimit` — max outstanding balance allowed
- `CustomerCredit.termOfPayment` — days until payment due (set by admin)
- At checkout: `termOfPaymentSnapshot` copied from CustomerCredit to Order
- Enforcement: `outstandingCredit + newOrderTotal > creditLimit` → 400
- Credit settlement: admin calls `PATCH /admin/orders/:id/settle-credit` → sets `creditSettledAt`
- Customer view: `GET /customer/credit` returns limit + outstanding balance

---

## Order Completion

- Customer: `PATCH /customer/orders/:id/complete` → sets `customerCompletedAt`
- Admin (credit settle): `PATCH /admin/orders/:id/settle-credit` → sets `creditSettledAt`
- Order status `done` can also be set via `PATCH /admin/orders/:id/status`

---

## Complaint System

- Customer files: `POST /customer/orders/:id/complaints` (comment + evidenceImageUrls)
- `OrderComplaint.status` lifecycle: `open` → `accepted` / `rejected` → `resolved`
- Admin updates: `PATCH /admin/orders/:id/complaints/:complaintId/status`
- Admin fields: `adminNote`, `acceptedByAdminId`, `rejectedByAdminId`, `resolvedByAdminId`

---

## Background Jobs (`src/jobs/`)

| File | Schedule | Purpose |
|---|---|---|
| `expire-orders.job.ts` | `ORDER_EXPIRY_CRON_MINUTES` (default 5) | Finds `pending_payment` orders past `expiresAt`, restores stock via `restoreOrderStock` (creates StockMovement records), sets status to `expired_unpaid` |
| `overdue-delivery.job.ts` | every hour (`0 * * * *`) | Finds `shipped` **delivery** orders where `assignedAt > 48h` ago and `overdueNotifiedAt` is null; sends WA to admin via `notifyAdminDeliveryOverdue`; sets `overdueNotifiedAt` (fires once per order) |

Jobs are started in `server.ts` after DB connects. All jobs are inside the Node.js process — no system cron or VPS configuration needed.

---

## Order Expiry Notes

- `ORDER_EXPIRY_MINUTES=30` in `.env` — controls `expiresAt` set at checkout (payment window)
- `ORDER_EXPIRY_CRON_MINUTES=5` in `.env` — controls how often the expiry cron check runs (default 5)
- node-cron job in `src/jobs/expire-orders.job.ts` runs inside the API process — no VPS/system cron needed
- Lazy fallback also in `getOrderStatus` and `uploadPaymentProof`
- Stock decremented at checkout (inside transaction), restored on expiry (cron + lazy fallback)
- `OrderItem.variantId` kept for stock restoration; each restore creates a `StockMovement` record

---

## WhatsApp Notifications (`src/utils/whatsapp.ts`)

Uses **Fonnte** — Indonesian WA gateway. No Meta Business API approval needed. Works with a regular WhatsApp number (scan QR on fonnte.com dashboard).

**Env vars:**

- `FONNTE_TOKEN` — API token from fonnte.com
- `FONNTE_ENABLED=true` — must be set to enable (default false, logs to console instead)
- `ADMIN_WHATSAPP` — admin phone number (format: `628xx...`)

**Behavior:**

- All sends are fire-and-forget using `void` — WA failure never crashes the main API flow
- Phone numbers normalized: `08xx → 628xx` automatically
- API uses `multipart/form-data` with `Authorization: TOKEN` header (not Bearer)

**Templates available:**
| Function | Trigger | Wired? |
|---|---|---|
| `notifyOrderPlaced` | Customer places order | ✅ checkout.service.ts |
| `notifyAdminNewOrder` | Customer places order | ✅ checkout.service.ts |
| `notifyAdminDeliveryOverdue` | Cron job — delivery not completed after 48h (delivery orders only) → admin | ✅ overdue-delivery.job.ts |
| `notifyAdminComplaint` | Customer files complaint (delivery orders only) → admin | ✅ customer/orders/orders.service.ts |

---

## Task Progress (vs task.md)

### ✅ Done

- 0.1–0.7 All infra (Docker, CI/CD, staging, MinIO, local PostgreSQL, node-cron)
- 0.8 Migrate prod to local stack
- 0.9 Fix Admin.phone → @@unique([storeId, phone])
- 1.1, 1.3 Customer auth + pricing
- 1.5 Credit term (termOfPayment per customer, snapshotted at checkout)
- 2.2 Order expiry + auto-cancel (node-cron + lazy fallback)
- 2.1 Cart management (CartItem model, full CRUD at /customer/cart, guest merge on login)
- 2.3 Minimum order validation
- 2.4 Order completion (customer + credit settle)
- 3.4 Legacy product discount
- 3.6 Variant-level discount rules
- 3.7 Product-level discount rules
- 5.1 Delivery zone management
- 5.3 Courier assignment
- 6.2 Bank transfer payment (multiple bank accounts via StoreBankAccount)
- 6.3 Credit payment flow
- 6.4 Unpaid invoice enforcement
- 7.1 Real-time stock visibility
- 7.2 Stock movement ledger + export
- 8.1 Sales dashboard
- 8.2 Login activity chart (login events to DB + chart in admin dashboard)
- 9.1 Complaint submission + admin lifecycle

- 5.5 Delivery SLA — overdue WA + in-app notification done (48h cron, delivery only)
- 9.3 WhatsApp notifications — order placed + delivery overdue + complaint (all scoped to delivery orders; other events excluded by design)

### ⚠️ Partial

- 3.5 Shipping discount — free shipping threshold done; partial % discount not implemented

### ❌ Not Started / Todo

- 1.4 Auto credit eligibility (3 cash transactions gate)
- 4.1/4.2 Voucher system
- 5.5 Delivery SLA tracking
