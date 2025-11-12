import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

// Reuse the pool across hot reloads in dev
const globalForPool = global as unknown as { pgPool?: Pool };

let pool: Pool;
if (connectionString) {
  pool =
    globalForPool.pgPool ??
    new Pool({
      connectionString,
      max: 5,
    });
  if (!globalForPool.pgPool) {
    globalForPool.pgPool = pool;
  }
} else {
  // Defer error until a DB call is actually made (so dev server can run without env)
  pool = new Proxy({} as Pool, {
    get() {
      throw new Error('DATABASE_URL is not set');
    },
  }) as Pool;
}

export const pgPool = pool;


