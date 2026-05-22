import { env } from './config/env.js';
import { buildApp } from './app.js';

import { pool } from './lib/db.js';
import { inboundWorker } from './services/queue.service.js';
import { outboundWorker } from './services/outbound-queue.service.js';
import { redisConnection } from './lib/redis.js';

const start = async () => {
  const app = await buildApp();
  try {
    await app.listen({ port: parseInt(env.PORT), host: '0.0.0.0' });
    app.log.info(`🚀 Shelby API listening on port ${env.PORT} [${env.NODE_ENV}]`);
    app.log.info(`Provider: ${env.MESSAGING_PROVIDER} | API Version: ${env.META_API_VERSION}`);
    if (env.NODE_ENV !== 'production') {
      app.log.info(`Verify Token: ${env.META_VERIFY_TOKEN}`);
      app.log.info(`Run: ngrok http ${env.PORT}`);
    }

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      app.log.info(`Received ${signal}. Shutting down gracefully...`);
      await app.close();
      if (inboundWorker) {
        app.log.info('Closing inbound worker...');
        await inboundWorker.close();
      }
      if (outboundWorker) {
        app.log.info('Closing outbound worker...');
        await outboundWorker.close();
      }
      if (redisConnection) {
        app.log.info('Disconnecting Redis...');
        redisConnection.disconnect();
      }
      await pool.end();
      process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
      app.log.error({ reason }, 'Unhandled rejection');
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
