import { db } from './db.js';

export class IdempotencyConflictError extends Error {
  constructor(key: string) {
    super(`Idempotency conflict for key: ${key}`);
    this.name = 'IdempotencyConflictError';
  }
}

/**
 * Ensures an operation is only executed once for a given key.
 * Used for Order Creation to prevent duplicate orders
 * if a user double-taps the confirm button.
 */
export async function withIdempotency<T>(
  key: string,
  scope: 'order_create' | 'webhook' | 'state_transition',
  operation: () => Promise<T>
): Promise<T> {
  const client = await db.getClient();
  try {
    await client.query(
      `INSERT INTO idempotency_keys (key, scope) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [key, scope]
    );

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

      const result = await operation();

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
