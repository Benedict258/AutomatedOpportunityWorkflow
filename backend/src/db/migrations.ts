import fs from 'fs';
import path from 'path';
import { getPool, executeQuery } from './connection.js';
import { logger } from '../utils/logger.js';

const MIGRATIONS_DIR = path.resolve(__dirname ?? process.cwd(), '../../migrations');
const MIGRATION_TABLE = 'schema_migrations';

export async function ensureMigrationTable(): Promise<void> {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function getAppliedMigrations(): Promise<string[]> {
  const result = await executeQuery<{ filename: string }>(
    `SELECT filename FROM ${MIGRATION_TABLE} ORDER BY applied_at`
  );
  return result.rows.map((row) => row.filename);
}

export async function getPendingMigrations(): Promise<string[]> {
  const applied = await getAppliedMigrations();
  
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    logger.warn({ dir: MIGRATIONS_DIR }, 'Migrations directory not found');
    return [];
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files.filter((f) => !applied.includes(f));
}

export async function applyMigration(filename: string): Promise<void> {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf-8');

  logger.info({ filename }, 'Applying migration');

  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      `INSERT INTO ${MIGRATION_TABLE} (filename) VALUES ($1)`,
      [filename]
    );
    await client.query('COMMIT');
    logger.info({ filename }, 'Migration applied successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ err: error, filename }, 'Migration failed');
    throw error;
  } finally {
    client.release();
  }
}

export async function runMigrations(): Promise<void> {
  logger.info('Starting database migrations');
  
  await ensureMigrationTable();
  const pending = await getPendingMigrations();

  if (pending.length === 0) {
    logger.info('No pending migrations');
    return;
  }

  logger.info({ count: pending.length, migrations: pending }, 'Found pending migrations');

  for (const migration of pending) {
    await applyMigration(migration);
  }

  logger.info('All migrations completed');
}

export async function checkMigrations(): Promise<{ applied: string[]; pending: string[] }> {
  await ensureMigrationTable();
  const [applied, pending] = await Promise.all([
    getAppliedMigrations(),
    getPendingMigrations(),
  ]);
  return { applied, pending };
}