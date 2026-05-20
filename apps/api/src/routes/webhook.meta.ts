import crypto from 'crypto';
import { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { enqueueIncomingMessage } from '../services/queue.service.js';

function verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!env.META_APP_SECRET) return true;  // Skip in dev if no secret configured
  if (!signature) return false;

  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', env.META_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSig, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
}

export default async function metaWebhookRoutes(fastify: FastifyInstance) {
  // GET: Meta Webhook Verification
  fastify.get('/webhook/meta', async (request, reply) => {
    const query = request.query as any;
    if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === env.META_VERIFY_TOKEN) {
      fastify.log.info('✅ Webhook verified by Meta');
      return reply.code(200).send(query['hub.challenge']);
    }
    return reply.code(403).send('Forbidden');
  });

  // POST: Incoming Messages (with HMAC verification)
  fastify.post('/webhook/meta', async (request, reply) => {
    // 1. Verify HMAC signature
    const rawBody = (request as any).rawBody as Buffer;
    const signature = request.headers['x-hub-signature-256'] as string | undefined;
    if (!verifySignature(rawBody, signature)) {
      fastify.log.warn('⚠️ Invalid webhook signature rejected');
      return reply.code(403).send('Invalid signature');
    }

    // 2. Process messages
    const body = request.body as any;
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.value?.messages) {
            const message = change.value.messages[0];
            await enqueueIncomingMessage(message.from, message);
          }
        }
      }
      return reply.code(200).send('EVENT_RECEIVED');
    }
    return reply.code(404).send();
  });
}
