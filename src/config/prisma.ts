import { PrismaClient } from '@prisma/client';

// ─── Prisma Singleton ─────────────────────────────────────────────────────────
// Prevents multiple PrismaClient instances during hot-reload in development.
// DATABASE_URL is read from the environment (supports multi-tenant override).

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
    errorFormat: 'pretty',
  });
};

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  if (!globalThis.__prisma) {
    globalThis.__prisma = createPrismaClient();
  }
  prisma = globalThis.__prisma;
}

export default prisma;
