# 📚 Online Shop UMKM - API Documentation

## Overview

REST API for multi-tenant e-commerce platform built with Express.js, Prisma ORM, and PostgreSQL.

- **Base URL:** `http://localhost:3000/api`
- **Authentication:** JWT Bearer Token
- **Content-Type:** `application/json`

---

## 🔐 Authentication

### POST /auth/login

Admin login with phone or email.

**Request:**
```json
{
  "identifier": "628111111111",
  "password": "admin123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": "uuid",
      "name": "Owner UMKM",
      "role": "owner",
      "storeId": "uuid"
    }
  }
}
```

**JWT Payload:**
```json
{
  "adminId": "uuid",
  "storeId": "uuid",
  "role": "owner | manager | staff"
}
```

---

## 🛡️ RBAC (Role-Based Access Control)

| Action | Owner | Manager | Staff |
|--------|-------|---------|-------|
| Manage Admin | ✅ | ❌ | ❌ |
| Manage Store | ✅ | ✅ | ❌ |
| Manage Products | ✅ | ✅ | ✅ |
| Confirm Payment | ✅ | ✅ | ✅ |

---

## 🌐 Public APIs (No Auth Required)

### GET /products

List all products.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| storeId | uuid | Filter by store (optional) |

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Products fetched successfully",
  "data": [
    {
      "id": "uuid",
      "storeId": "uuid",
      "name": "StreetFlex Sneakers",
      "description": "Sneakers kasual dengan sol ringan",
      "basePrice": 350000,
      "images": [
        { "id": "uuid", "imageUrl": "https://..." }
      ],
      "options": [
        {
          "id": "uuid",
          "name": "Size",
          "values": [
            { "id": "uuid", "value": "39" },
            { "id": "uuid", "value": "40" }
          ]
        }
      ],
      "variants": [
        {
          "id": "uuid",
          "sku": "SFS-39-HIT",
          "stock": 10,
          "price": 350000,
          "options": [
            { "optionId": "uuid", "optionValueId": "uuid", "value": "39" }
          ]
        }
      ],
      "store": {
        "id": "uuid",
        "name": "Urban Outfit Local",
        "whatsappNumber": "628123456789"
      }
    }
  ]
}
```

---

### GET /products/:id

Get single product details.

**Response (200):** Same structure as above (single object)

**Response (404):**
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Product not found"
}
```

---

### POST /checkout

Create a new order (guest checkout).

**Request:**
```json
{
  "storeId": "uuid",
  "customerPhone": "628123456789",
  "customerEmail": "customer@example.com",
  "items": [
    {
      "productId": "uuid",
      "variantId": "uuid",
      "quantity": 2
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Order created successfully",
  "data": {
    "publicOrderId": "ORD-ABC123-XYZ",
    "status": "pending_payment",
    "totalAmount": 700000,
    "expiresAt": "2026-03-01T12:00:00.000Z",
    "items": [
      {
        "productName": "StreetFlex Sneakers",
        "variantDescription": "Size: 39, Color: Hitam",
        "price": 350000,
        "quantity": 2
      }
    ],
    "store": {
      "name": "Urban Outfit Local",
      "whatsappNumber": "628123456789",
      "bankAccountName": "Urban Outfit Local",
      "bankAccountNumber": "1234567890",
      "bankName": "BCA",
      "qrisImageUrl": null
    }
  }
}
```

---

### POST /payment-proof

Upload payment proof for an order.

**Request:**
```json
{
  "publicOrderId": "ORD-ABC123-XYZ",
  "imageUrl": "https://example.com/proof.jpg"
}
```

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Payment proof uploaded successfully",
  "data": {
    "publicOrderId": "ORD-ABC123-XYZ",
    "status": "waiting_confirmation",
    "paymentProof": {
      "id": "uuid",
      "imageUrl": "https://example.com/proof.jpg",
      "uploadedAt": "2026-02-28T12:00:00.000Z"
    }
  }
}
```

---

### GET /order/:publicOrderId

Get order status by public order ID.

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Order fetched successfully",
  "data": {
    "publicOrderId": "ORD-ABC123-XYZ",
    "status": "waiting_confirmation",
    "totalAmount": 700000,
    "expiresAt": "2026-03-01T12:00:00.000Z",
    "createdAt": "2026-02-28T12:00:00.000Z",
    "items": [...],
    "paymentProof": {...},
    "store": {
      "name": "Urban Outfit Local",
      "whatsappNumber": "628123456789"
    }
  }
}
```

---

## 🔒 Admin APIs (JWT Required)

All admin endpoints require the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

---

### GET /admin/store

Get current store details. **Requires: manager or owner**

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Store fetched successfully",
  "data": {
    "id": "uuid",
    "name": "Urban Outfit Local",
    "logoUrl": null,
    "bannerUrl": null,
    "footerText": null,
    "whatsappNumber": "628123456789",
    "email": "hello@urbanoutfitlocal.id",
    "address": "Jl. Sudirman No. 12, Jakarta",
    "bankAccountName": "Urban Outfit Local",
    "bankAccountNumber": "1234567890",
    "bankName": "BCA",
    "qrisImageUrl": null,
    "createdAt": "2026-02-28T00:00:00.000Z",
    "updatedAt": "2026-02-28T00:00:00.000Z"
  }
}
```

---

### PATCH /admin/store

Update store details. **Requires: manager or owner**

**Request:**
```json
{
  "name": "New Store Name",
  "whatsappNumber": "628999999999",
  "bankName": "Mandiri"
}
```

**Response (200):** Updated store object

---

### GET /admin/products

List all products for current store. **Requires: staff+**

**Response (200):** Array of products with full details

---

### POST /admin/products

Create a new product. **Requires: staff+**

**Request:**
```json
{
  "name": "New Product",
  "description": "Product description",
  "basePrice": 100000
}
```

**Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Product created successfully",
  "data": {
    "id": "uuid",
    "storeId": "uuid",
    "name": "New Product",
    "description": "Product description",
    "basePrice": 100000,
    "images": [],
    "options": [],
    "variants": []
  }
}
```

---

### GET /admin/products/:id

Get product by ID. **Requires: staff+**

---

### PATCH /admin/products/:id

Update product. **Requires: staff+**

**Request:**
```json
{
  "name": "Updated Name",
  "basePrice": 120000
}
```

---

### DELETE /admin/products/:id

Delete product. **Requires: staff+**

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Product deleted successfully",
  "data": null
}
```

---

### POST /admin/products/:id/images

Add product image. **Requires: staff+**

**Request:**
```json
{
  "imageUrl": "https://example.com/image.jpg"
}
```

---

### DELETE /admin/products/:id/images/:imageId

Delete product image. **Requires: staff+**

---

### POST /admin/products/:id/options

Add product option (e.g., Size, Color). **Requires: staff+**

**Request:**
```json
{
  "name": "Size",
  "values": ["S", "M", "L", "XL"]
}
```

**Response (201):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Option added successfully",
  "data": {
    "id": "uuid",
    "productId": "uuid",
    "name": "Size",
    "values": [
      { "id": "uuid", "value": "S" },
      { "id": "uuid", "value": "M" },
      { "id": "uuid", "value": "L" },
      { "id": "uuid", "value": "XL" }
    ]
  }
}
```

---

### DELETE /admin/products/:id/options/:optionId

Delete product option. **Requires: staff+**

---

### POST /admin/products/:id/variants

Add product variant. **Requires: staff+**

**Request:**
```json
{
  "sku": "PROD-S-BLK",
  "priceOverride": 120000,
  "stock": 50,
  "optionValueIds": ["uuid-size-s", "uuid-color-black"]
}
```

**Note:** `priceOverride` is optional. If null, uses `product.basePrice`.

---

### PATCH /admin/products/:id/variants/:variantId

Update variant. **Requires: staff+**

**Request:**
```json
{
  "stock": 25,
  "priceOverride": 130000
}
```

---

### DELETE /admin/products/:id/variants/:variantId

Delete variant. **Requires: staff+**

---

### GET /admin/orders

List all orders for current store. **Requires: staff+**

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | enum | Filter by status (optional) |

**Status Values:**
- `pending_payment`
- `waiting_confirmation`
- `paid`
- `shipped`
- `done`
- `cancelled`
- `expired_unpaid`

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Orders fetched successfully",
  "data": [
    {
      "id": "uuid",
      "publicOrderId": "ORD-ABC123-XYZ",
      "status": "waiting_confirmation",
      "totalAmount": 700000,
      "expiresAt": "2026-03-01T12:00:00.000Z",
      "createdAt": "2026-02-28T12:00:00.000Z",
      "customer": {
        "id": "uuid",
        "phone": "628123456789",
        "email": "customer@example.com"
      },
      "items": [...],
      "paymentProof": {...}
    }
  ]
}
```

---

### GET /admin/orders/:id

Get single order by ID. **Requires: staff+**

---

### PATCH /admin/orders/:id/confirm

Confirm payment (changes status from `waiting_confirmation` to `paid`). **Requires: staff+**

**Response (200):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Payment confirmed successfully",
  "data": {
    "id": "uuid",
    "publicOrderId": "ORD-ABC123-XYZ",
    "status": "paid",
    ...
  }
}
```

---

### PATCH /admin/orders/:id/status

Update order status manually. **Requires: staff+**

**Request:**
```json
{
  "status": "shipped"
}
```

---

## 📋 Order Status Flow

```
pending_payment → waiting_confirmation → paid → shipped → done
                                      ↘ cancelled
pending_payment → expired_unpaid (after 24h)
```

---

## 🏗️ Data Models

### Product Price Logic

```
Final Price = variant.priceOverride ?? product.basePrice
```

- Products can have a `basePrice`
- Variants can override with `priceOverride`
- If `priceOverride` is null, use `basePrice`

### Variant System

```
Product
  └── Options (e.g., "Size", "Color")
        └── Values (e.g., "S", "M", "L" / "Red", "Blue")
  └── Variants (combinations)
        └── OptionValues (links to specific option values)
```

**Example:**
- Product: T-Shirt (basePrice: 100000)
- Options: Size [S, M, L], Color [Red, Blue]
- Variants:
  - Size S + Red → stock: 10, priceOverride: null
  - Size M + Blue → stock: 5, priceOverride: 110000

---

## 🔗 API Endpoints Summary

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | /auth/login | ❌ | - | Admin login |
| GET | /products | ❌ | - | List products |
| GET | /products/:id | ❌ | - | Get product |
| POST | /checkout | ❌ | - | Create order |
| POST | /payment-proof | ❌ | - | Upload payment |
| GET | /order/:publicOrderId | ❌ | - | Track order |
| GET | /admin/store | ✅ | manager+ | Get store |
| PATCH | /admin/store | ✅ | manager+ | Update store |
| GET | /admin/products | ✅ | staff+ | List products |
| POST | /admin/products | ✅ | staff+ | Create product |
| GET | /admin/products/:id | ✅ | staff+ | Get product |
| PATCH | /admin/products/:id | ✅ | staff+ | Update product |
| DELETE | /admin/products/:id | ✅ | staff+ | Delete product |
| POST | /admin/products/:id/images | ✅ | staff+ | Add image |
| DELETE | /admin/products/:id/images/:imageId | ✅ | staff+ | Delete image |
| POST | /admin/products/:id/options | ✅ | staff+ | Add option |
| DELETE | /admin/products/:id/options/:optionId | ✅ | staff+ | Delete option |
| POST | /admin/products/:id/variants | ✅ | staff+ | Add variant |
| PATCH | /admin/products/:id/variants/:variantId | ✅ | staff+ | Update variant |
| DELETE | /admin/products/:id/variants/:variantId | ✅ | staff+ | Delete variant |
| GET | /admin/orders | ✅ | staff+ | List orders |
| GET | /admin/orders/:id | ✅ | staff+ | Get order |
| PATCH | /admin/orders/:id/confirm | ✅ | staff+ | Confirm payment |
| PATCH | /admin/orders/:id/status | ✅ | staff+ | Update status |

---

## 📄 Documentation Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /api/openapi.json | OpenAPI 3.0 specification |
| GET /api/docs | Scalar interactive documentation |

---

## ⚠️ Error Responses

All errors follow this format:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Error description"
}
```

Common status codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error
