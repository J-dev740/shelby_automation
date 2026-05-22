import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../lib/redis.js';

import { QueueMessagingProvider } from '../adapters/messaging/queue.provider.js';
import { handleIncomingMessage } from '../orchestrator/fsm.js';

let inboundQueue: Queue | null = null;
export let inboundWorker: Worker | null = null;

const provider = new QueueMessagingProvider();


// Initialize BullMQ if redisConnection is available
if (redisConnection) {
  try {
    inboundQueue = new Queue('inbound-message', { connection: redisConnection });

    inboundWorker = new Worker('inbound-message', async job => {
      const { from, message } = job.data;
      console.log(`[BullMQ Worker] Processing job ${job.id} for ${from}`);
      await handleIncomingMessage(from, message, provider);
    }, { 
      connection: redisConnection,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    });

    inboundWorker.on('failed', (job, err) => {
      console.error(`[BullMQ Worker] Job ${job?.id} failed:`, err);
    });

    console.log('✅ BullMQ inbound-message queue initialized');
  } catch (err) {
    console.error('❌ Failed to initialize BullMQ inbound worker:', err);
  }
} else {
  console.log('ℹ️ REDIS_URL not set. Using in-memory queue fallback for inbound messages.');
}

/**
 * Enqueues an incoming webhook message for processing.
 * Decouples the Fastify webhook route from FSM execution.
 */
export async function enqueueIncomingMessage(from: string, message: any): Promise<void> {
  if (inboundQueue) {
    await inboundQueue.add('message', { from, message }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  } else {
    // In-memory fallback for local dev / testing without Redis
    // Execute asynchronously to immediately unblock the caller
    setImmediate(async () => {
      try {
        console.log(`[In-Memory Queue] Processing message for ${from}`);
        await handleIncomingMessage(from, message, provider);
      } catch (err) {
        console.error(`[In-Memory Queue] Failed to process message for ${from}:`, err);
      }
    });
  }
}
