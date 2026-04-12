# Task Board — Online Store System

> Organized by Epic (Parent). Story Points use Fibonacci scale. All tasks start as `Todo`.

---

## Epic 1: Customer Management & Auth

> Customer types: **Guest** (non-login, base price) and **Ritel** (registered, wholesale price). Only admin can create ritel accounts. No B2B/B2C distinction.

| # | Task | Description | SP | Status |
|---|---|---|---|---|
| 1.1 | Ritel customer registration | Admin creates ritel customer accounts; ritel gets wholesale price, guest gets base price; admin can enable/disable accounts | 3 | Done |
| 1.2 | ~~Store customer registration~~ | ~~Removed — no B2B distinction. All customers are either guest or ritel.~~ | - | N/A |
| 1.3 | Customer type pricing logic | Guest → basePrice, Ritel (logged-in) → wholesalePrice. Applied at checkout and product listing. | 3 | Done |
| 1.4 | Credit eligibility system | Require 3 successful cash transactions before credit is available; admin can manually override | 8 | Todo |
| 1.5 | Credit term configuration | Admin-configurable credit terms (e.g. 1–2 weeks per customer or globally) | 3 | Todo |

---

## Epic 2: Ordering System

| # | Task | Description | SP | Status |
|---|---|---|---|---|
| 2.1 | Cart management | Add/remove items, order per unit (PCS) | 5 | Done |
| 2.2 | Cart expiration & auto-cancel | Auto-cancel cart after 30 minutes of inactivity (duration configurable by admin) | 3 | Todo |
| 2.3 | Minimum order validation | Enforce minimum order amount before checkout (configurable by admin) | 2 | Todo |

---

## Epic 3: Pricing & Discounts

| # | Task | Description | SP | Status |
|---|---|---|---|---|
| 3.4 | Product-specific discount | Independent discount % per product for Harga Normal (guest) and Harga Retail (ritel). Toggle on/off. Applies to all variants of the product. 1 discount per product. startDate/endDate reserved for future. | 3 | Done |
| 3.5 | Shipping discount rules | Apply partial or free shipping discount based on minimum order in Rupiah | 3 | Todo |

---

## Epic 4: Voucher & Rewards
**Total: 13 SP**

| # | Task | Description | SP | Status |
|---|---|---|---|---|
| 4.1 | Voucher generation | Issue reward vouchers to customers after recurring purchases (rules configurable) | 5 | Todo |
| 4.2 | Voucher redemption | Allow customers to apply voucher as price deduction during checkout | 5 | Todo |

---

## Epic 5: Delivery System
**Total: 29 SP**

| # | Task | Description | SP | Status |
|---|---|---|---|---|
| 5.1 | Delivery zone management | Define and manage serviceable delivery zones via admin | 5 | Done |
| 5.2 | Red zone enforcement | Block delivery requests to non-serviceable/restricted areas | 3 | Todo |
| 5.3 | Courier assignment (retail) | Assign motorbike couriers to retail orders; handle capacity checks | 5 | Done |
| 5.5 | Delivery SLA tracking | Track delivery SLA (retail 24h, store 48h); flag overdue deliveries for action, related to 9.1 (customer can complaints) | 5 | Todo |

---

## Epic 6: Payment System

| # | Task | Description | SP | Status |
|---|---|---|---|---|
| 6.2 | Bank transfer payment flow | Handle bank transfer submission, manual/auto confirmation, then process order | 5 | Done |
| 6.3 | Credit payment flow (B2B) | Process orders on credit for eligible store customers; defer payment to agreed term | 8 | Todo |
| 6.4 | Unpaid invoice enforcement (Credit) | Block new orders for customers with outstanding invoices; admin can override, related to 1.4 and 1.5 | 3 | Todo |

---

## Epic 7: Inventory

| # | Task | Description | SP | Status |
|---|---|---|---|---|
| 7.1 | Real-time stock visibility | Display warehouse stock in real-time (refreshed within 24h); visible to customers during ordering | 5 | Done |

---

## Epic 9: Complaints & Monitoring
**Total: 15 SP**

| # | Task | Description | SP | Status |
|---|---|---|---|---|
| 9.1 | Complaint submission | Customer can file a complaint if delivery exceeds SLA (retail 24h / store 48h) | 5 | Todo |
| 9.3 | Reminder notifications | Notify customers and admin of pending deliveries, upcoming due dates, and overdue payments | 5 | Todo |

---
