import { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { enqueueIncomingMessage } from '../services/queue.service.js';

export default async function metaWebhookRoutes(fastify: FastifyInstance) {
  // 1. Meta Webhook Verification (GET)
  // Meta calls this when you configure the webhook URL in their dashboard
  fastify.get('/webhook/meta', async (request, reply) => {
    const query = request.query as any;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
      fastify.log.info('✅ Webhook verified by Meta');
      return reply.code(200).send(challenge);
    }
    return reply.code(403).send('Forbidden');
  });

  // 2. Incoming Messages (POST)
  // Meta sends chat events here
  fastify.post('/webhook/meta', async (request, reply) => {
    const body = request.body as any;

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          // Check if there is an actual message
          if (change.value && change.value.messages) {
            const message = change.value.messages[0];
            const from = message.from;
            
            // Decoupled processing via BullMQ / In-memory queue
            await enqueueIncomingMessage(from, message);
          }
        }
      }
      // Meta requires a 200 OK fast
      return reply.code(200).send('EVENT_RECEIVED');
    }
    
    return reply.code(404).send();
  });
}
