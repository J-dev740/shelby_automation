import { describe, it, expect, afterAll } from 'vitest';
import { pool } from '../../lib/db.js';
import { withIdempotency, acquireWebhookLock } from '../../lib/idempotency.js';

describe('Idempotency Layer Integration', () => {
  afterAll(async () => {
  });

  it('B1: First request → Executes & Caches', async () => {
    const key = `test:b1:${Date.now()}`;
    let executed = false;
    const result = await withIdempotency(key, 'webhook', async () => {
      executed = true;
      return { success: true };
    });
    expect(executed).toBe(true);
    expect(result.success).toBe(true);
  });

  it('B2: Duplicate request → returns cached result', async () => {
    const key = `test:b2:${Date.now()}`;
    let executeCount = 0;
    const action = async () => {
      executeCount++;
      return { count: executeCount };
    };

    const res1 = await withIdempotency(key, 'webhook', action);
    const res2 = await withIdempotency(key, 'webhook', action);

    expect(executeCount).toBe(1);
    expect(res1.count).toBe(1);
    expect(res2.count).toBe(1);
  });

  it('B3: Concurrent duplicate requests → only one execution', async () => {
    const key = `test:b3:${Date.now()}`;
    let executeCount = 0;
    const action = async () => {
      executeCount++;
      await new Promise(r => setTimeout(r, 50));
      return { count: executeCount };
    };

    const promises = [
      withIdempotency(key, 'webhook', action),
      withIdempotency(key, 'webhook', action),
      withIdempotency(key, 'webhook', action)
    ];

    const results = await Promise.all(promises);
    expect(executeCount).toBe(1);
    results.forEach(res => expect(res.count).toBe(1));
  });
  
  it('B4: Webhook lock (SETNX style)', async () => {
    const msgId = `msg_${Date.now()}`;
    const first = await acquireWebhookLock(msgId);
    const second = await acquireWebhookLock(msgId);
    
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
