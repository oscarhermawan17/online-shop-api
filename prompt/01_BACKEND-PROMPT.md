Create a production-ready Express.js v5 backend project using Node.js and Prisma ORM with PostgreSQL.

Requirements:

Tech Stack:
- Express.js v5
- Prisma ORM
- PostgreSQL
- JWT Auth ready
- dotenv
- Modular folder structure
- Multi-tenant ready via DATABASE_URL env
- TypeScript

Project Setup:

1. Initialize a Node.js project with TypeScript.
2. Install dependencies:
   express
   prisma
   @prisma/client
   dotenv
   jsonwebtoken
   bcrypt
   cors
   helmet
   morgan

Dev dependencies:
   typescript
   ts-node
   nodemon
   @types/express
   @types/node
   @types/jsonwebtoken
   @types/bcrypt

3. Create folder structure:

src/
 ├── app.ts
 ├── server.ts
 ├── config/
 │    └── prisma.ts
 ├── middlewares/
 │    ├── error.middleware.ts
 │    └── auth.middleware.ts
 ├── modules/
 │    └── health/
 │         ├── health.controller.ts
 │         ├── health.service.ts
 │         └── health.routes.ts
 └── utils/

4. Setup Prisma:
- Initialize Prisma
- Use PostgreSQL datasource from env:

DATABASE_URL="postgresql://user:password@localhost:5432/tenant_db"

5. Create basic Prisma schema with only:

model HealthCheck {
  id        String   @id @default(uuid())
  status    String
  createdAt DateTime @default(now())
}

6. Setup Prisma Client in config/prisma.ts

7. Express App Requirements:

- Use:
  express.json()
  cors
  helmet
  morgan

- Add global error handler

8. Create modular routing system.

9. Add Health Check endpoint:

GET /api/health

Should:
- write to DB
- return success response

10. JWT Auth Middleware scaffold only (no full auth yet).

11. Environment ready for multi-tenant usage:
Database connection must rely entirely on DATABASE_URL.

12. Add scripts:

dev
build
start
prisma:migrate
prisma:generate

13. Ensure project runs with:

npm run dev

14. Provide README with setup steps:
- install
- prisma migrate
- run dev