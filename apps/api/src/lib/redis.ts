import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export let redisConnection: Redis | null = null;

if (env.REDIS_URL) {
  try {
    redisConnection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      family: 0,
      keepAlive: 10000,
      tls: env.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    });
    console.log('✅ Redis connection initialized');
    
    redisConnection.on('error', (err) => {
      console.error('[Redis] Connection error:', err);
    });
  } catch (err) {
    console.error('❌ Failed to initialize Redis:', err);
  }
}
