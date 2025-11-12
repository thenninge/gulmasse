import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Attempt to load environment from common files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load .env.local if present (Next.js convention), otherwise fall back to .env or env vars
const envCandidates = [
  path.join(rootDir, '.env.local'),
  path.join(rootDir, '.env'),
];
for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is not set. Provide it via environment or .env.local/.env.');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });

async function run() {
  const client = await pool.connect();
  try {
    const migrationsDir = path.join(rootDir, 'db', 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort(); // run in lexicographic order

    if (files.length === 0) {
      console.log('No migration files found.');
      return;
    }

    console.log(`Running ${files.length} migration(s)...`);
    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf8');
      console.log(`\n-- ${file} --`);
      await client.query(sql);
      console.log(`Applied: ${file}`);
    }
    console.log('\nAll migrations applied successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});


