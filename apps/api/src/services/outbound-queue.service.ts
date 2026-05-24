import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../lib/redis.js';
import { env } from '../config/env.js';
import { MetaCloudProvider } from '../adapters/messaging/meta-cloud.provider.js';
import { MockMessagingProvider } from '../adapters/messaging/mock.provider.js';
import { MessagingProvider } from '../adapters/messaging/provider.interface.js';

let outboundQueue: Queue | null = null;
export let outboundWorker: Worker | null = null;

// The provider to be used for actually sending the message
const provider: MessagingProvider = env.MESSAGING_PROVIDER === 'meta'
  ? new MetaCloudProvider(env.META_API_TOKEN || '', env.META_PHONE_ID || '', env.META_API_VERSION)
  : new MockMessagingProvider();

if (redisConnection) {
  try {
    outboundQueue = new Queue('outbound-message', { connection: redisConnection });
    outboundQueue.on('error', (err) => {
      console.error(`[BullMQ Outbound Queue] Connection error:`, err.message);
    });

    outboundWorker = new Worker('outbound-message', async job => {
      const { to, method, args } = job.data;
      console.log(`[BullMQ Outbound Worker] Processing job ${job.id} for ${to}`);
      
      // Dynamically call the provider method
      if (typeof (provider as any)[method] === 'function') {
        await (provider as any)[method](to, ...args);
      } else {
        throw new Error(`Provider method ${method} not found`);
      }
    }, { 
      connection: redisConnection,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      limiter: {
        max: 30, // 30 messages
        duration: 1000, // per 1 second (leaves headroom below Meta's 80/sec limit)
      }
    });

    outboundWorker.on('failed', (job, err) => {
      const { to, method } = job?.data ?? {};
      console.error(`[BullMQ Outbound] FAILED jobId=${job?.id} method=${method} to=${to} err=${err.message}`);
    });

    outboundWorker.on('error', (err) => {
      console.error(`[BullMQ Outbound Worker] Connection/Internal error:`, err.message);
    });

    console.log('✅ BullMQ outbound-message queue initialized');
  } catch (err) {
    console.error('❌ Failed to initialize BullMQ outbound worker:', err);
  }
} else {
  console.log('ℹ️ REDIS_URL not set. Using in-memory queue fallback for outbound messages.');
}

export async function enqueueOutboundMessage(to: string, method: string, ...args: any[]): Promise<void> {
  if (outboundQueue) {
    await outboundQueue.add('message', { to, method, args }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  } else {
    // In-memory fallback
    setImmediate(async () => {
      try {
        console.log(`[In-Memory Outbound Queue] Sending to ${to}`);
        if (typeof (provider as any)[method] === 'function') {
          await (provider as any)[method](to, ...args);
        }
      } catch (err) {
        console.error(`[In-Memory Outbound Queue] Failed to send to ${to}:`, err);
      }
    });
  }
}
