# online-shop-api — Claude Context

## Stack
- Node.js + Express v5 + TypeScript + Prisma ORM
- Database: Supabase (PostgreSQL), always online — same DB for local dev and production
- Port: **4000**
- Structure: `src/modules/{public,customer,admin}/` + `src/middlewares/`

---

## Database (.env)

Only `DATABASE_URL` is used — no `DIRECT_URL`:

```
# For dev & production (pooler port 6543) — works on Biznet WiFi
DATABASE_URL=postgresql://postgres.xceemlzendhddaghwerv:...@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true

# For db push & seed (direct port 5432) — works on Telkomsel only (Biznet blocks 5432)
# DATABASE_URL=postgresql://postgres:...@db.xceemlzendhddaghwerv.supabase.co:5432/postgres
```

**Push/seed workflow:** switch to Telkomsel → uncomment direct URL → run push/seed → switch back to pooler.

Commands:
- Reset DB: `npx prisma db push --force-reset`
- Seed: `npm run prisma:seed`

Seed uses static `STORE_ID = process.env.STORE_ID_DEFAULT ?? 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'`

---

## Multi-Tenant Architecture

- **Chosen approach: separate identity tables (Option A)** — not a single users table with roles
- Every tenant table has `storeId` — already complete, nothing needs to be added
- 3 identity types, each a separate table with its own auth flow:

| Table | storeId | Auth endpoint | Status |
|---|---|---|---|
| `Superadmin` | ❌ none | `/api/superadmin/auth/login` | Future — not built yet |
| `Admin` | ✅ required | `/api/auth/login` | Done |
| `Customer` | ✅ required | `/api/customer-auth/login` | Done |

- Models correctly WITHOUT storeId: `Store` (is the tenant), `HealthCheck` (not tenant data), `VariantOptionValue` (pure join table, inherits scope via Variant)
- When superadmin is needed: add a new `Superadmin` model + new middleware — zero changes to existing admin/customer code

---

## All Models (schema.prisma)

All models have `storeId` except Store, HealthCheck, and VariantOptionValue (intentional — see above).

| Model | Purpose |
|---|---|
| Store | Tenant config (bank details, QRIS, WhatsApp) |
| Admin | Admin accounts; roles: owner / manager / staff |
| Customer | Store-scoped customers; password nullable (guest) |
| CustomerAddress | Saved delivery addresses |
| Product | Has basePrice + wholesalePrice |
| ProductImage | Gallery images |
| ProductOption | Option types (e.g. "Size", "Color") |
| ProductOptionValue | Option values (e.g. "M", "Black") |
| Variant | Sellable SKU; priceOverride, wholesalePriceOverride, stock |
| VariantOptionValue | Join: Variant ↔ ProductOptionValue |
| Order | status enum, expiresAt (30mins), deliveryMethod (pickup/delivery) |
| OrderItem | Price/name snapshot; includes variantId for stock restoration on expiry |
| PaymentProof | Bank transfer image upload |
| ShippingZone | District → cost mapping |
| ShippingDriver | Courier master list |
| ShippingShift | Delivery shift templates |
| OrderShippingAssignment | Courier dispatch record per order |
| ProductDiscount | One per product; normalDiscount + normalDiscountActive (guest), retailDiscount + retailDiscountActive (ritel); startDate/endDate nullable (future use) |

---

## All Endpoints

### Public (no auth)
```
GET  /api/health
GET  /api/store
GET  /api/products              (optional customer auth → wholesale pricing)
GET  /api/products/:id
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
GET    /api/customer/addresses
POST   /api/customer/addresses
PATCH  /api/customer/addresses/:id
DELETE /api/customer/addresses/:id
```

### Admin (requireAuth + requireRole)
```
# Store — manager+
GET   /api/admin/store
PATCH /api/admin/store

# Products — staff+
GET/POST                          /api/admin/products
GET/PATCH/DELETE                  /api/admin/products/:id
POST/DELETE                       /api/admin/products/:id/images
POST/DELETE                       /api/admin/products/:id/images/:imageId
POST/DELETE                       /api/admin/products/:id/options
POST/DELETE                       /api/admin/products/:id/options/:optionId
POST                              /api/admin/products/:id/variants
PATCH/DELETE                      /api/admin/products/:id/variants/:variantId

# Customers — staff+
GET/POST                          /api/admin/customers
PATCH                             /api/admin/customers/:id/toggle-status

# Orders — staff+
GET                               /api/admin/orders
GET                               /api/admin/orders/:id
PATCH                             /api/admin/orders/:id/confirm     (payment confirm → paid)
PATCH                             /api/admin/orders/:id/status      (manual status update)
PATCH                             /api/admin/orders/:id/ship        (assign courier)

# Shipping — manager+
GET/PUT/PATCH/DELETE              /api/admin/shipping-zones
GET/POST/PATCH/DELETE             /api/admin/shipping-drivers
GET/POST/PATCH/DELETE             /api/admin/shipping-shifts

# Discount — staff+
PUT                               /api/admin/products/:id/discount
```

---

## Auth Middleware
- `requireAuth()` — validates admin JWT
- `requireRole(...roles)` — role hierarchy: owner ≥ manager ≥ staff
- `requireCustomerAuth()` — mandatory customer JWT
- `optionalCustomerAuth()` — guest-friendly (attaches customer if token present)

---

## Task Progress (vs task.md)

### ✅ Actually Done
| Task | Notes |
|---|---|
| 1.1 Ritel customer registration | Admin creates via POST /api/admin/customers; toggle-status endpoint exists |
| 1.3 Customer type pricing | Guest → basePrice, Ritel (logged-in) → wholesalePrice; applied at checkout + product listing |
| 2.2 Order expiration & auto-cancel | expiresAt = NOW() + ORDER_EXPIRY_MINUTES (default 30). pg_cron runs every 5 mins in Supabase (restores stock + sets expired_unpaid). Lazy fallback in getOrderStatus + uploadPaymentProof. |
| 3.4 Product-specific discount | ProductDiscount model; independent % for Harga Normal + Harga Retail; toggle on/off; applies to all variants; PUT /admin/products/:id/discount |
| 5.1 Delivery zone management | Full CRUD, admin + public endpoint |
| 5.3 Courier assignment (retail) | Ship endpoint creates OrderShippingAssignment |
| 6.2 Bank transfer payment flow | checkout → proof upload → admin confirm |
| 7.1 Real-time stock visibility | Variant stock in product endpoints; decremented on checkout |

## Customer Types
- **Guest** — non-login, pays `basePrice`. Auto-created on checkout.
- **Ritel** — registered, pays `wholesalePrice`. Admin creates only. Can buy 1 or bulk.
- No B2B/B2C distinction. Task 1.2 (store customer) was removed as N/A.
- Pricing logic: checkout and product listing apply `wholesalePrice` when `authenticatedCustomerId` is present.

### ⚠️ Marked Done but Incomplete
| Task | What's missing |
|---|---|
| 2.1 Cart management | No persistent cart. Checkout validates items inline only. No add/remove cart endpoints. |
| 5.2 Red zone enforcement | No zone validation during checkout. ShippingZone exists but not enforced. |

### ❌ Not Started
| Task | Notes |
|---|---|
| 1.4 Credit eligibility | No model |
| 1.5 Credit term configuration | No model |
| 2.3 Minimum order validation | Not implemented |
| 3.5 Shipping discount rules | No model |
| 4.1 Voucher generation | No model |
| 4.2 Voucher redemption | No model |
| 5.5 Delivery SLA tracking | No model |
| 6.3 Credit payment flow | No model |
| 6.4 Unpaid invoice enforcement | No model |
| 9.1 Complaint submission | No model |
| 9.3 Reminder notifications | No model |

## Order Expiry Notes
- `ORDER_EXPIRY_MINUTES=30` in `.env` — controls expiresAt at checkout
- pg_cron job `expire-unpaid-orders` runs every 5 mins in Supabase SQL
- Lazy fallback in `getOrderStatus` and `uploadPaymentProof`
- Stock decremented at checkout, restored on expiry (both pg_cron + lazy)
- `OrderItem.variantId` added to schema for stock restoration
