import { env } from './config/env.js';
import { buildApp } from './app.js';

const start = async () => {
  const app = await buildApp();
  try {
    await app.listen({ port: parseInt(env.PORT), host: '0.0.0.0' });
    console.log(`\n==============================================`);
    console.log(`🚀 DEMO SERVER LISTENING ON PORT ${env.PORT}`);
    console.log(`==============================================`);
    console.log(`1. Run 'ngrok http ${env.PORT}' in a new terminal`);
    console.log(`2. Paste 'https://<your-ngrok-url>/webhook/meta' into Meta Dashboard`);
    console.log(`3. Use Verify Token: '${env.META_VERIFY_TOKEN}'`);
    console.log(`==============================================\n`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
