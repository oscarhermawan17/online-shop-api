# Task Board — Online Store System

> Organized by Epic (Parent). Story Points use Fibonacci scale. All tasks start as `Todo`.
> Last updated: 2026-05-02

---

## Epic 0: Infrastructure & DevOps

| #   | Task | Description | SP | Status |
| --- | ---- | ----------- | -- | ------ |
| 0.1 | Docker Compose setup | Single docker-compose with prod + stg services; nginx routing both domains | 3 | Done |
| 0.2 | Staging domain SSL | `stg.tokotimika.my.id` with Let's Encrypt cert | 1 | Done |
| 0.3 | CI/CD multi-branch | GitHub Actions: `main` → `:latest`, `stg` → `:staging`; auto-deploy to VPS via SSH | 3 | Done |
| 0.4 | Deploy user | Minimal `deploy` user on VPS; docker + umkm group only; SSH key in GitHub secrets | 1 | Done |
| 0.5 | Local PostgreSQL for stg | Replace Supabase cloud with PostgreSQL Docker container for stg | 3 | Done |
| 0.6 | MinIO for stg | Replace Cloudinary with MinIO Docker container for stg; upload code updated to presign flow | 5 | Done |
| 0.7 | node-cron for stg | Replace pg_cron with node-cron inside Express for order expiry (stg has no Supabase pg_cron) | 2 | Todo |
| 0.8 | Migrate prod to local stack | Move prod from Supabase cloud + Cloudinary → VPS local (after stg is stable) | 5 | Todo |

---

## Epic 1: Customer Management & Auth

> Customer types: **Guest** (non-login, base price) and **Ritel** (registered, wholesale price). Only admin can create ritel accounts. No B2B/B2C distinction.

| #   | Task                            | Description                                                                                                                 | SP  | Status |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --- | ------ |
| 1.1 | Ritel customer registration     | Admin creates ritel customer accounts; ritel gets wholesale price, guest gets base price; admin can enable/disable accounts; admin can change type (base↔wholesale) via PATCH /:id/type | 3   | Done   |
| 1.2 | ~~Store customer registration~~ | ~~Removed — no B2B distinction. All customers are either guest or ritel.~~                                                  | -   | N/A    |
| 1.3 | Customer type pricing logic     | Guest → basePrice, Ritel (logged-in) → wholesalePrice. Applied at checkout and product listing.                             | 3   | Done   |
| 1.4 | Credit eligibility system       | Require 3 successful cash transactions before credit is available; admin can manually override                              | 8   | Todo   |
| 1.5 | Credit term configuration       | Admin-configurable term of payment (days) per customer via `termOfPayment` on CustomerCredit; snapshotted at checkout as `termOfPaymentSnapshot` on Order | 3   | Done   |

---

## Epic 2: Ordering System

| #   | Task                           | Description                                                                                                                                                                                              | SP  | Status |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------ |
| 2.1 | Cart management                | Add/remove items, order per unit (PCS). **No persistent cart** — current checkout validates items inline only; cart is client-side Zustand only.                                                         | 5   | Todo   |
| 2.2 | Order expiration & auto-cancel | Auto-cancel unpaid orders after 30 minutes; stock restored automatically. expiresAt set at checkout via ORDER_EXPIRY_MINUTES env. pg_cron runs every 5 mins in Supabase. Lazy fallback in API endpoints. | 3   | Done   |
| 2.3 | Minimum order validation       | Enforce minimum order amount before checkout (configurable by admin)                                                                                                                                     | 2   | Done   |
| 2.4 | Order completion flow          | Customer marks order done via PATCH /customer/orders/:id/complete (sets customerCompletedAt). Admin can settle credit orders via PATCH /admin/orders/:id/settle-credit. | 2 | Done |

---

## Epic 3: Pricing & Discounts

| #   | Task                      | Description                                                                                                                                                                                                 | SP  | Status |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------ |
| 3.4 | Product-specific discount (legacy) | Simple % discount per product for Harga Normal and Harga Retail. Toggle on/off. PUT /admin/products/:id/discount. Still active but superseded by 3.6/3.7 for new rules. | 3   | Done   |
| 3.5 | Shipping discount rules   | Free shipping threshold IS implemented (deliveryRetailFreeShippingMinimumOrder in Store; applied at checkout). Partial/% shipping discount NOT yet implemented. | 3   | Partial |
| 3.6 | Variant-level discount rules | VariantDiscountRule model: trigger by quantity or line_subtotal, value as % or fixed, apply per_item or line_total, target by customerType. Full CRUD at /admin/products/:id/variants/:variantId/discount-rules. Applied at checkout. | 5 | Done |
| 3.7 | Product-level discount rules | ProductDiscountRule model: same trigger/value/apply/customerType as variant rules, but applies across all (or targeted) variants of a product. Full CRUD at /admin/products/:id/discount-rules. Applied at checkout. | 5 | Done |

---

## Epic 4: Voucher & Rewards

| #   | Task               | Description                                                                       | SP  | Status |
| --- | ------------------ | --------------------------------------------------------------------------------- | --- | ------ |
| 4.1 | Voucher generation | Issue reward vouchers to customers after recurring purchases (rules configurable) | 5   | Todo   |
| 4.2 | Voucher redemption | Allow customers to apply voucher as price deduction during checkout               | 5   | Todo   |

---

## Epic 5: Delivery System

| #   | Task                        | Description                                                                                                              | SP  | Status |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --- | ------ |
| 5.1 | Delivery zone management    | Define and manage serviceable delivery zones via admin                                                                   | 5   | Done   |
| 5.2 | Red zone enforcement        | Block delivery requests to non-serviceable/restricted areas. ShippingZone exists but zone validation NOT enforced at checkout. | 3   | Todo   |
| 5.3 | Courier assignment (retail) | Assign motorbike couriers to retail orders; handle capacity checks                                                       | 5   | Done   |
| 5.5 | Delivery SLA tracking       | Track delivery SLA (retail 24h, store 48h); flag overdue deliveries for action, related to 9.1 (customer can complaints) | 5   | Todo   |

---

## Epic 6: Payment System

| #   | Task                                | Description                                                                                          | SP  | Status |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- | --- | ------ |
| 6.2 | Bank transfer payment flow          | Handle bank transfer submission, manual/auto confirmation, then process order                        | 5   | Done   |
| 6.3 | Credit payment flow                 | Process orders on credit for eligible customers; defer payment to agreed term. Checkout accepts `paymentMethod: 'credit'`; validates credit limit; sets status: paid, expiresAt: null. | 8   | Done   |
| 6.4 | Unpaid invoice enforcement (Credit) | Block new orders for customers with outstanding invoices; admin can override, related to 1.4 and 1.5 | 3   | Done   |

---

## Epic 7: Inventory

| #   | Task                       | Description                                                                                       | SP  | Status |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------- | --- | ------ |
| 7.1 | Real-time stock visibility | Display warehouse stock in real-time; visible to customers during ordering. Variant stock in product endpoints; decremented at checkout, restored on expiry. | 5   | Done   |
| 7.2 | Stock movement ledger      | Full StockMovement model tracking every in/out event (initial_stock, add_stock, sale, restore). Admin can view history with date/product/variant/category filters. Export to XLS. Add stock adjustment via POST /admin/inventory/add. | 5 | Done |

---

## Epic 8: Dashboard & Reporting

| #   | Task                | Description                                                                                                                                 | SP  | Status |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------ |
| 8.1 | Sales dashboard     | GET /api/admin/dashboard; period filter (today/yesterday/this_month/last_month/custom); totalSales, totalOrders, newCustomers + growth % vs prev period; sales trend chart (hourly/daily); item rankings by qty and value | 5   | Done   |

---

## Epic 9: Complaints & Monitoring

| #   | Task                   | Description                                                                                | SP  | Status |
| --- | ---------------------- | ------------------------------------------------------------------------------------------ | --- | ------ |
| 9.1 | Complaint submission   | Customer files a complaint via POST /customer/orders/:id/complaints with comment + evidence images. Admin updates complaint status (open→accepted/rejected/resolved) via PATCH /admin/orders/:id/complaints/:complaintId/status. OrderComplaint model with full lifecycle. | 5   | Done   |
| 9.3 | Reminder notifications | Notify customers and admin of pending deliveries, upcoming due dates, and overdue payments | 5   | Todo   |

---

## Progress Summary

| Status  | Count |
| ------- | ----- |
| Done    | 21    |
| Partial | 1     |
| Todo    | 8     |
| N/A     | 1     |
