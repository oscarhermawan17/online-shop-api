# Online Shop API

Production-ready REST API built with **Express.js v5**, **TypeScript**, **Prisma ORM**, and **PostgreSQL**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express.js v5 |
| Language | TypeScript 5 |
| ORM | Prisma 6 |
| Database | PostgreSQL |
| Auth | JWT (scaffold ready) |
| Security | Helmet, CORS |
| Logging | Morgan |

---

## Project Structure

```
online-shop-api/
├── prisma/
│   └── schema.prisma          # Prisma schema (PostgreSQL)
├── src/
│   ├── app.ts                 # Express app factory
│   ├── server.ts              # Entry point + graceful shutdown
│   ├── config/
│   │   └── prisma.ts          # Prisma client singleton
│   ├── middlewares/
│   │   ├── auth.middleware.ts # JWT auth scaffold
│   │   └── error.middleware.ts# Global error handler
│   ├── modules/
│   │   └── health/
│   │       ├── health.controller.ts
│   │       ├── health.routes.ts
│   │       └── health.service.ts
│   └── utils/
│       └── response.ts        # Typed response helpers
├── .env.example
├── nodemon.json
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** running locally or via a connection string

---

### 1. Install Dependencies

```bash
npm install
```

---

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
PORT=3000
NODE_ENV=development

# Replace with your actual PostgreSQL connection string
DATABASE_URL="postgresql://user:password@localhost:5432/online_shop_db"

# Replace with a strong random secret
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d
```

> **Multi-tenant usage:** Override `DATABASE_URL` per deployment/container to point each tenant at its own database.

---

### 3. Generate Prisma Client

```bash
npm run prisma:generate
```

---

### 4. Run Database Migration

```bash
npm run prisma:migrate
```

When prompted, enter a migration name, e.g. `init`.

---

### 5. Start Development Server

```bash
npm run dev
```

Server starts at **http://localhost:3000** with hot reload via Nodemon.

---

## API Reference

### Health Check

```
GET /api/health
```

Writes a record to the database and returns API status.

**Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "API is healthy",
  "data": {
    "id": "a1b2c3d4-...",
    "status": "ok",
    "createdAt": "2026-02-28T00:00:00.000Z"
  }
}
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Start compiled production server |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | Create and apply DB migration |

---

## Production Build

```bash
npm run build
npm start
```

---

## Authentication

JWT middleware is scaffolded in `src/middlewares/auth.middleware.ts`.

To protect a route, import and attach the middleware:

```typescript
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { myController } from './my.controller';

const router = Router();

router.get('/protected', authMiddleware, myController);

export default router;
```

The middleware:
- Reads the `Authorization: Bearer <token>` header
- Verifies the token against `JWT_SECRET`
- Attaches the decoded payload to `req.user`
- Returns `401 Unauthorized` on missing or invalid tokens

---

## Error Handling

All errors should be forwarded to Express via `next(error)`.  
Use `AppError` to create operational errors with a specific HTTP status code:

```typescript
import { AppError } from '../../middlewares/error.middleware';

throw new AppError('Resource not found', 404);
// or
next(new AppError('Forbidden', 403));
```

The global error handler in `src/middlewares/error.middleware.ts` will format all errors consistently:

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Resource not found"
}
```

In development mode, a `stack` trace is also included in the response.

---

## Adding a New Module

Follow the modular pattern under `src/modules/`:

```
src/modules/<feature>/
  ├── <feature>.controller.ts   # Request/response handling
  ├── <feature>.service.ts      # Business logic + Prisma queries
  └── <feature>.routes.ts       # Express Router
```

Register the router in `src/app.ts`:

```typescript
import featureRoutes from './modules/<feature>/<feature>.routes';
app.use('/api/<feature>', featureRoutes);
```
