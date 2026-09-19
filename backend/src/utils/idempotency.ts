import { getPool } from '../db/connection';
import { config } from '../config/index';
import { logger } from './logger';
import { createHash } from 'crypto';

const IDEMPOTENCY_TABLE = 'idempotency_keys';

export interface IdempotencyRecord {
  key: string;
  request_hash: string;
  response_status: number;
  response_body: string;
  created_at: Date;
  expires_at: Date;
}

export async function ensureIdempotencyTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${IDEMPOTENCY_TABLE} (
      key VARCHAR(255) PRIMARY KEY,
      request_hash VARCHAR(64) NOT NULL,
      response_status INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_idempotency_expires 
    ON ${IDEMPOTENCY_TABLE} (expires_at);
  `);
}

export function hashRequest(method: string, url: string, body: unknown): string {
  const content = `${method}:${url}:${JSON.stringify(body)}`;
  return createHash('sha256').update(content).digest('hex');
}

export async function checkIdempotency(
  key: string,
  method: string,
  url: string,
  body: unknown
): Promise<{ status: number; body: unknown } | null> {
  try {
    await ensureIdempotencyTable();
    
    const requestHash = hashRequest(method, url, body);
    const pool = getPool();
    
    const result = await pool.query<IdempotencyRecord>(
      `SELECT response_status, response_body 
       FROM ${IDEMPOTENCY_TABLE} 
       WHERE key = $1 AND request_hash = $2 AND expires_at > NOW()`,
      [key, requestHash]
    );

    if (result.rows.length > 0) {
      const record = result.rows[0];
      logger.info({ key }, 'Idempotency key hit - returning cached response');
      return {
        status: record.response_status,
        body: JSON.parse(record.response_body),
      };
    }

    return null;
  } catch (error) {
    logger.error({ err: error, key }, 'Idempotency check failed');
    return null;
  }
}

export async function storeIdempotency(
  key: string,
  method: string,
  url: string,
  body: unknown,
  status: number,
  responseBody: unknown
): Promise<void> {
  try {
    await ensureIdempotencyTable();
    
    const requestHash = hashRequest(method, url, body);
    const ttlMs = config.idempotency.ttlMs;
    const expiresAt = new Date(Date.now() + ttlMs);
    
    const pool = getPool();
    
    await pool.query(
      `INSERT INTO ${IDEMPOTENCY_TABLE} (key, request_hash, response_status, response_body, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO UPDATE SET
         request_hash = EXCLUDED.request_hash,
         response_status = EXCLUDED.response_status,
         response_body = EXCLUDED.response_body,
         expires_at = EXCLUDED.expires_at`,
      [key, requestHash, status, JSON.stringify(responseBody), expiresAt]
    );
  } catch (error) {
    logger.error({ err: error, key }, 'Failed to store idempotency key');
  }
}

export function idempotencyMiddleware() {
  return async (request: any, reply: any) => {
    // Only apply to mutating methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return;
    }

    const idempotencyKey = request.headers['idempotency-key'];
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return; // Optional - not required for all endpoints
    }

    // Check for existing response
    const cached = await checkIdempotency(
      idempotencyKey,
      request.method,
      request.url,
      request.body
    );

    if (cached) {
      reply.header('X-Idempotency-Replay', 'true');
      return reply.code(cached.status).send(cached.body);
    }

    // Store original send to capture response
    const originalSend = reply.send.bind(reply);
    reply.send = (payload: any) => {
      // Store idempotency key after successful response
      if (reply.statusCode < 500) {
        storeIdempotency(
          idempotencyKey,
          request.method,
          request.url,
          request.body,
          reply.statusCode,
          payload
        ).catch(() => {}); // Fire and forget
      }
      return originalSend(payload);
    };
  };
}