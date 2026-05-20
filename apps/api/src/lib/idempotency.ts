import { db } from './db.js';

export class IdempotencyConflictError extends Error {
  constructor(key: string) {
    super(`Idempotency conflict for key: ${key}`);
    this.name = 'IdempotencyConflictError';
  }
}

/**
 * Ensures an operation is only executed once for a given key.
 * Used for Order Creation (as per Phase 1 PRD) to prevent duplicate orders
 * if a user double-taps the confirm button.
 */
export async function withIdempotency<T>(
  key: string,
  scope: 'order_create' | 'webhook' | 'state_transition',
  operation: () => Promise<T>
): Promise<T> {
  const client = await db.getClient();
  try {
    // 1. Ensure the key exists (Insert if missing)
    await client.query(
      `INSERT INTO idempotency_keys (key, scope) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [key, scope]
    );

    // 2. Acquire a row-level lock and get the current result
    // If another transaction is currently running withIdempotency for this key,
    // this SELECT FOR UPDATE will block until that transaction commits or rolls back.
    await client.query('BEGIN');
    try {
      const res = await client.query(
        `SELECT result_json FROM idempotency_keys WHERE key = $1 AND scope = $2 FOR UPDATE`,
        [key, scope]
      );

      if (res.rowCount && res.rows[0].result_json) {
        await client.query('COMMIT');
        return res.rows[0].result_json as T;
      }

      // 3. Execute the operation since we are the first (or result was missing)
      const result = await operation();

      // 4. Save the result and commit
      await client.query(
        `UPDATE idempotency_keys SET result_json = $1 WHERE key = $2`,
        [JSON.stringify(result), key]
      );
      await client.query('COMMIT');

      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
  }
}

/**
 * Lightweight SETNX equivalent for Webhooks using Postgres (until Redis is ready)
 */
export async function acquireWebhookLock(msgId: string): Promise<boolean> {
  const key = `wh:${msgId}`;
  try {
    await db.query(
      `INSERT INTO idempotency_keys (key, scope) VALUES ($1, 'webhook')`,
      [key]
    );
    return true; // Lock acquired
  } catch (err: any) {
    if (err.code === '23505') {
      return false; // Lock already exists (duplicate webhook)
    }
    throw err;
  }
}
