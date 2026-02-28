import prisma from '../../config/prisma';
import type { HealthCheck } from '@prisma/client';

// ─── Health Service ───────────────────────────────────────────────────────────

/**
 * Creates a new HealthCheck record in the database and returns it.
 * Acts as both a DB connectivity probe and an audit trail.
 */
export const checkHealth = async (): Promise<HealthCheck> => {
  const record = await prisma.healthCheck.create({
    data: { status: 'ok' },
  });
  return record;
};
