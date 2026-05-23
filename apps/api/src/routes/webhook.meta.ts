import crypto from 'crypto';
import { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { enqueueIncomingMessage } from '../services/queue.service.js';

function verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!env.META_APP_SECRET) {
    // No secret configured — skip verification (dev/test only)
    return true;
  }
  if (!signature) return false;

  const expectedSig =
    'sha256=' +
    crypto.createHmac('sha256', env.META_APP_SECRET).update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSig, 'utf8'),
      Buffer.from(signature, 'utf8'),
    );
  } catch {
    return false;
  }
}

export default async function metaWebhookRoutes(fastify: FastifyInstance) {
  // -------------------------------------------------------------------------
  // GET /webhook/meta — Meta webhook verification handshake
  // -------------------------------------------------------------------------
  fastify.get('/webhook/meta', async (request, reply) => {
    const query = request.query as Record<string, string>;

    fastify.log.info(
      { mode: query['hub.mode'], hasToken: !!query['hub.verify_token'] },
      '[Webhook/Meta] GET verification attempt',
    );

    if (query['hub.mode'] !== 'subscribe') {
      fastify.log.warn(
        { mode: query['hub.mode'] },
        '[Webhook/Meta] Verification failed — unexpected hub.mode',
      );
      return reply.code(403).send('Forbidden');
    }

    if (query['hub.verify_token'] !== env.META_VERIFY_TOKEN) {
      fastify.log.warn(
        { receivedToken: query['hub.verify_token'] },
        '[Webhook/Meta] Verification failed — token mismatch',
      );
      return reply.code(403).send('Forbidden');
    }

    fastify.log.info('[Webhook/Meta] ✅ Webhook verified by Meta');
    return reply.code(200).send(query['hub.challenge']);
  });

  // -------------------------------------------------------------------------
  // POST /webhook/meta — Incoming messages from Meta Cloud API
  // -------------------------------------------------------------------------
  fastify.post('/webhook/meta', async (request, reply) => {
    const rawBody = (request as any).rawBody as Buffer;
    const signature = request.headers['x-hub-signature-256'] as string | undefined;

    fastify.log.info(
      {
        contentType: request.headers['content-type'],
        hasSignature: !!signature,
        bodyBytes: rawBody?.length ?? 0,
      },
      '[Webhook/Meta] POST received',
    );

    // 1. Verify HMAC signature
    const sigValid = verifySignature(rawBody, signature);
    if (!sigValid) {
      fastify.log.warn(
        { signature, hasSecret: !!env.META_APP_SECRET },
        '[Webhook/Meta] ❌ Signature verification failed — rejecting request',
      );
      return reply.code(403).send('Invalid signature');
    }

    fastify.log.debug('[Webhook/Meta] ✅ Signature verified');

    // 2. Parse and process messages
    const body = request.body as any;

    fastify.log.debug(
      { object: body?.object, entryCount: body?.entry?.length ?? 0 },
      '[Webhook/Meta] Parsed payload',
    );

    if (body?.object !== 'whatsapp_business_account') {
      fastify.log.info(
        { object: body?.object },
        '[Webhook/Meta] Ignoring non-WhatsApp payload',
      );
      return reply.code(404).send();
    }

    // 3. Enqueue each inbound message — fail loudly if enqueue throws
    try {
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const messages: any[] = change.value?.messages ?? [];
          for (const message of messages) {
            fastify.log.info(
              { from: message.from, type: message.type, messageId: message.id },
              '[Webhook/Meta] Enqueueing inbound message',
            );
            await enqueueIncomingMessage(message.from, message);
          }
        }
      }
    } catch (err) {
      fastify.log.error(
        { err },
        '[Webhook/Meta] ❌ Failed to enqueue message — returning 500',
      );
      return reply.code(500).send('Internal Server Error');
    }

    return reply.code(200).send('EVENT_RECEIVED');
  });
}
