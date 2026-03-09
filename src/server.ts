import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import prisma from './config/prisma';

const PORT = process.env.PORT ?? 3000;
const NODE_ENV = process.env.NODE_ENV ?? 'development';

let server: any;

const startServer = async (): Promise<void> => {
  try {
    // Verify database connection on startup
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    server = app.listen(PORT, () => {
      console.log(`🚀 Server running in [${NODE_ENV}] mode on port ${PORT}`);
      console.log(`📍 Health check → http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal: string): Promise<void> => {
  console.log(`\n${signal} received — shutting down gracefully...`);
  
  if (server) {
    server.close(async () => {
      await prisma.$disconnect();
      console.log('✅ Database disconnected');
      process.exit(0);
    });
  } else {
    await prisma.$disconnect();
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
