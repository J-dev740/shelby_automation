import fastify from 'fastify';
import cors from '@fastify/cors';
import crypto from 'crypto';
import { env } from './config/env.js';
import metaWebhookRoutes from './routes/webhook.meta.js';
import razorpayWebhookRoutes from './routes/webhook.razorpay.js';
import supabaseWebhookRoutes from './routes/webhook.supabase.js';
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

  // Webhook routes are called by Meta/Razorpay/Supabase servers — not browsers.
  // CORS does not apply to server-to-server requests (no Origin header), so these
  // calls are always allowed. For browser-originated requests we keep a restrictive
  // allowlist. HMAC signature verification remains the real auth layer for webhooks.
  await app.register(cors, {
    origin: (origin, cb) => {
      // No Origin header → server-to-server call (Meta, Razorpay, Supabase, etc.)
      if (origin === undefined || origin === null) {
        cb(null, true);
        return;
      }

      // Browser requests: restrict to known origins
      const allowedBrowserOrigins: Array<string | RegExp> =
        env.NODE_ENV === 'production'
          ? [
              /\.vercel\.app$/,
              // Add your custom domain here once live, e.g.:
              // 'https://dashboard.shelby.cafe',
            ]
          : [/^http:\/\/localhost:\d+$/];

      const allowed = allowedBrowserOrigins.some(pattern =>
        typeof pattern === 'string' ? pattern === origin : pattern.test(origin),
      );

      if (!allowed) {
        app.log.warn({ origin }, '[CORS] Rejected browser request from unlisted origin');
      }

      cb(null, allowed);
    },
    credentials: true,
  });

  // Rate limiting (60 req/min per IP on webhook routes)
  await app.register(rateLimitPlugin);

  await app.register(metaWebhookRoutes);
  await app.register(razorpayWebhookRoutes);
  await app.register(supabaseWebhookRoutes);
  app.get('/health', async () => ({ status: 'ok', version: '1.0.0', env: env.NODE_ENV }));

  return app;
}
