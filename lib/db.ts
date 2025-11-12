import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Next.js will only evaluate this on the server. For route handlers, an env must be set.
  throw new Error('DATABASE_URL is not set');
}

// Reuse the pool across hot reloads in dev
const globalForPool = global as unknown as { pgPool?: Pool };

export const pgPool =
  globalForPool.pgPool ??
  new Pool({
    connectionString,
    max: 5,
  });

if (!globalForPool.pgPool) {
  globalForPool.pgPool = pgPool;
}


