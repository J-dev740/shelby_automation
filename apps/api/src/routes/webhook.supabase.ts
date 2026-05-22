import { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { db } from '../lib/db.js';
import { MESSAGES } from '../orchestrator/messages.js';
import { QueueMessagingProvider } from '../adapters/messaging/queue.provider.js';

export default async function supabaseWebhookRoutes(fastify: FastifyInstance) {
  fastify.post('/webhook/supabase/order-ready', async (request, reply) => {
    // 1. Verify Secret Token (Passed in URL or Headers)
    const secret = request.headers['x-supabase-webhook-secret'] as string | undefined;
    if (env.SUPABASE_WEBHOOK_SECRET && secret !== env.SUPABASE_WEBHOOK_SECRET) {
      fastify.log.warn('⚠️ Invalid Supabase webhook secret');
      return reply.code(403).send('Forbidden');
    }

    const body = request.body as any;

    // We only care about UPDATE events on the orders table
    if (body.type === 'UPDATE' && body.table === 'orders') {
      const newRecord = body.record;
      const oldRecord = body.old_record;

      // Only trigger if state CHANGED to 'ready'
      if (newRecord.state === 'ready' && oldRecord?.state !== 'ready') {
        
        // Fetch customer phone
        const custRes = await db.query(`SELECT phone_e164 FROM customers WHERE id = $1`, [newRecord.customer_id]);
        if (custRes.rowCount && custRes.rowCount > 0) {
          const phone = custRes.rows[0].phone_e164;
          
          const provider = new QueueMessagingProvider();

          await provider.sendText(phone, MESSAGES.ORDER_READY(newRecord.order_code));
        }
      }
    }

    return reply.code(200).send({ status: 'ok' });
  });
}
