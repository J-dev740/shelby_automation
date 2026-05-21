/**
 * rate-limit.plugin.ts
 * Sliding-window rate limiter for the /webhook/meta route.
 *
 * Strategy: 60 requests per 60-second window per originating phone number.
 * Uses Upstash Redis (HTTP REST) so it works in every environment without
 * a persistent TCP connection.  Falls back to a simple in-memory Map when
 * Upstash credentials are not configured (local dev / test).
 */

import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
interface RateLimitStore {
  increment(key: string, windowSeconds: number): Promise<number>;
}

// --------------------------------------------------------------------------
// Upstash REST store (production)
// --------------------------------------------------------------------------
class UpstashStore implements RateLimitStore {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  async increment(key: string, windowSeconds: number): Promise<number> {
    // INCR increments and returns the new count; EXPIRE sets the TTL only on
    // first call (NX flag) so the window doesn't reset on every request.
    const [incrRes, expireRes] = await Promise.all([
      fetch(`${this.url}/incr/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
      }),
      fetch(`${this.url}/expire/${encodeURIComponent(key)}/${windowSeconds}/NX`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
      }),
    ]);

    if (!incrRes.ok) {
      const body = await incrRes.text();
      throw new Error(`Upstash INCR failed: ${body}`);
    }
    const data = (await incrRes.json()) as { result: number };
    return data.result;
  }
}

// --------------------------------------------------------------------------
// In-memory fallback store (local dev without Upstash)
// --------------------------------------------------------------------------
class InMemoryStore implements RateLimitStore {
  private counters = new Map<string, { count: number; expiresAt: number }>();

  async increment(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const existing = this.counters.get(key);

    if (!existing || existing.expiresAt < now) {
      this.counters.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return 1;
    }

    existing.count += 1;
    return existing.count;
  }
}

// --------------------------------------------------------------------------
// Plugin
// --------------------------------------------------------------------------
const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 60;

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  const store: RateLimitStore =
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
      ? new UpstashStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN)
      : new InMemoryStore();

  const storeType = env.UPSTASH_REDIS_REST_URL ? 'Upstash' : 'InMemory';
  fastify.log.info(`[RateLimit] Using ${storeType} store (${MAX_REQUESTS} req/${WINDOW_SECONDS}s per key)`);

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only rate-limit inbound webhook POSTs
    if (request.method !== 'POST' || !request.url.startsWith('/webhook/meta')) return;

    // Derive key from X-Forwarded-For → remote IP → 'unknown'
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.socket?.remoteAddress ||
      'unknown';

    const key = `shelby:rl:${ip}`;

    try {
      const count = await store.increment(key, WINDOW_SECONDS);

      reply.header('X-RateLimit-Limit', MAX_REQUESTS);
      reply.header('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - count));

      if (count > MAX_REQUESTS) {
        fastify.log.warn({ ip, count }, '[RateLimit] Request rejected — limit exceeded');
        reply.code(429).send({ error: 'Too Many Requests', retryAfter: WINDOW_SECONDS });
        return;
      }
    } catch (err) {
      // Never block a real webhook due to a rate-limit store error — log and pass through.
      fastify.log.error({ err }, '[RateLimit] Store error — bypassing limit');
    }
  });
};

export default fp(rateLimitPlugin, { name: 'rate-limit' });
