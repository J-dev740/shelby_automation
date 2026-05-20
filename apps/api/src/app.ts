import fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import metaWebhookRoutes from './routes/webhook.meta.js';

export async function buildApp() {
  const app = fastify({ 
    logger: false 
  });

  await app.register(cors);
  await app.register(metaWebhookRoutes);

  app.get('/health', async () => ({ status: 'ok', version: 'demo-1.0' }));

  return app;
}
