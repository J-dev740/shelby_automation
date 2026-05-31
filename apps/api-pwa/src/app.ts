import fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { menuRoutes } from './routes/menu.routes.js';
import { cartRoutes } from './routes/cart.routes.js';
import { orderRoutes } from './routes/order.routes.js';

export async function buildApp() {
  const app = fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
    },
  });

  // CORS — allow Vercel frontend origin
  const corsOrigins = env.NODE_ENV === 'production'
    ? env.CORS_ORIGIN.split(',').map(o => o.trim())
    : [/^http:\/\/localhost:\d+$/];

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });

  // Routes
  await app.register(menuRoutes, { prefix: '/api' });
  await app.register(cartRoutes, { prefix: '/api' });
  await app.register(orderRoutes, { prefix: '/api' });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'shelby-pwa-api',
    version: '1.0.0',
    env: env.NODE_ENV,
  }));

  return app;
}
