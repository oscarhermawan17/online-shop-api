# 🚀 FULL MVP API GENERATION PROMPT

## Express + Prisma + Scalar Documentation

---

## 🧠 Context

This project is an MVP multi-tenant-ready e-commerce backend built using:

* Express.js
* Prisma ORM
* PostgreSQL

The Prisma schema is already defined.

You MUST read and understand the existing Prisma schema before generating any API logic.

---

## 🎯 Objective

Generate a complete REST API system for:

* Admin authentication (JWT)
* Product management
* Variant system
* Guest checkout
* Manual payment confirmation
* RBAC authorization

Also generate:

* OpenAPI specification
* Scalar API documentation UI

Documentation must clearly show:

* Public endpoints
* Protected endpoints
* Role-based access rules

---

## ⚠️ Critical Instructions

Before implementing anything:

1. Read the existing Prisma schema.
2. Base ALL logic strictly on existing models.
3. Do NOT create new models unless absolutely necessary.
4. Respect existing relationships.

---

## 🔐 Authentication

Admin login must support:

* phone + password
* OR email + password

Passwords are already hashed using bcrypt.

### Endpoint

```
POST /auth/login
```

### Response

```json
{
  "token": "jwt_token",
  "admin": {
    "id": "uuid",
    "name": "string",
    "role": "owner | manager | staff",
    "storeId": "uuid"
  }
}
```

### JWT Payload

```json
{
  "adminId": "uuid",
  "storeId": "uuid",
  "role": "owner | manager | staff"
}
```

Use:

```
JWT_SECRET
```

from environment variables.

---

## 🛡 RBAC Rules

Roles:

* owner
* manager
* staff

### Permissions

| Action          | Owner | Manager | Staff |
| --------------- | ----- | ------- | ----- |
| Manage Admin    | ✔     | ❌       | ❌     |
| Manage Store    | ✔     | ✔       | ❌     |
| Manage Product  | ✔     | ✔       | ✔     |
| Confirm Payment | ✔     | ✔       | ✔     |

Implement:

* `requireAuth` middleware
* `requireRole` middleware

---

## 🌍 API Structure

Separate APIs into:

### Public APIs

```
GET /products
GET /products/:id
POST /checkout
POST /payment-proof
GET /order/:publicOrderId
```

Guest checkout must:

* Automatically create Customer
* Validate phone/email

---

### Admin APIs (JWT Required)

```
POST /auth/login

GET /admin/store
PATCH /admin/store

POST /admin/products
PATCH /admin/products/:id
DELETE /admin/products/:id

POST /admin/products/:id/images
POST /admin/products/:id/options
POST /admin/products/:id/variants

GET /admin/orders
PATCH /admin/orders/:id/confirm
```

---

## 🛒 Order Rules

* Use OrderItem snapshot
* Use publicOrderId for tracking
* Support expiry logic
* Support payment proof upload

---

## 📦 Product Rules

Use existing variant system:

* Product.basePrice
* Variant.priceOverride (nullable)
* Gallery is optional
* Variants are optional

Final price logic:

```
variant.priceOverride ?? product.basePrice
```

---

## 📚 Scalar Documentation

Generate:

```
GET /openapi.json
GET /docs
```

Use:

```
@scalar/express-api-reference
```

Documentation must:

* Allow JWT input
* Show which endpoints are protected
* Show role requirements
* Include login endpoint

---

## 📁 Folder Structure

Use clean layered architecture:

```
controllers/
services/
middlewares/
routes/
docs/
```

---

## ⚙ Environment Variables

Use existing values:

```
JWT_SECRET
DATABASE_URL
```

---

## 🧠 Final Rule

Do NOT:

* Guess schema
* Create business logic outside Prisma relations

All logic must follow the schema.

---

## 🚀 Expected Output

Generate:

* Routes
* Controllers
* Services
* Middlewares
* OpenAPI spec
* Scalar UI setup

System must be fully runnable.

---

## 📍 Result Target

After generation:

```
GET /docs
```

Should allow:

* Login
* Copy JWT
* Test protected endpoints directly

---