import fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import metaWebhookRoutes from './routes/webhook.meta.js';
import razorpayWebhookRoutes from './routes/webhook.razorpay.js';
import supabaseWebhookRoutes from './routes/webhook.supabase.js';

export async function buildApp() {
  const app = fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
    },
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
      ? [/\.vercel\.app$/]      // production: Vercel domains only
      : [/^http:\/\/localhost:\d+$/],  // dev: any localhost port
    credentials: true,
  });

  await app.register(metaWebhookRoutes);
  await app.register(razorpayWebhookRoutes);
  await app.register(supabaseWebhookRoutes);
  app.get('/health', async () => ({ status: 'ok', version: '1.0.0', env: env.NODE_ENV }));

  return app;
}
