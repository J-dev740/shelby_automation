import fastify from 'fastify';
import cors from '@fastify/cors';
import crypto from 'crypto';
import { env } from './config/env.js';
import metaWebhookRoutes from './routes/webhook.meta.js';
import razorpayWebhookRoutes from './routes/webhook.razorpay.js';
import supabaseWebhookRoutes from './routes/webhook.supabase.js';
import flowsWebhookRoutes from './routes/webhook.flows.js';
import rateLimitPlugin from './plugins/rate-limit.plugin.js';

export async function buildApp() {
  const app = fastify({
    genReqId: (req) => (req.headers['x-request-id'] as string) || crypto.randomUUID(),
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
    },
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Request-Id', request.id);
  });

  // Capture raw body for HMAC verification
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    (req as any).rawBody = body;
    try {
      done(null, JSON.parse(body.toString()));
    } catch (err: any) {
      done(err, undefined);
    }
  });

  await app.register(cors, {
    origin: env.NODE_ENV === 'production'
      ? [
          // Allow any *.vercel.app subdomain (preview deploys) + explicit production domain
          /\.vercel\.app$/,
          // TODO: Replace with your custom domain once you have one, e.g.:
          // 'https://dashboard.shelby.cafe'
        ]
      : [/^http:\/\/localhost:\d+$/],  // dev: any localhost port
    credentials: true,
  });

  // Rate limiting (60 req/min per IP on webhook routes)
  await app.register(rateLimitPlugin);

  await app.register(metaWebhookRoutes);
  await app.register(razorpayWebhookRoutes);
  await app.register(supabaseWebhookRoutes);
  await app.register(flowsWebhookRoutes);
  app.get('/health', async () => ({ status: 'ok', version: '1.0.0', env: env.NODE_ENV }));

  return app;
}
