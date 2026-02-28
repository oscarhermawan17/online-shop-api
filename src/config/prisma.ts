import { PrismaClient } from '@prisma/client';

// ─── Prisma Singleton ─────────────────────────────────────────────────────────
// Prevents multiple PrismaClient instances during hot-reload in development.
// DATABASE_URL is read from the environment (supports multi-tenant override).

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export default prisma;
