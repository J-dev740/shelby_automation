import { db, pool } from './src/lib/db.js';
import { env } from './src/config/env.js';
import { sessionService } from './src/services/session.service.js';

async function main() {
  console.log('Loading db...');
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('DB connected:', res.rows[0].now);
  } catch (err) {
    console.error('DB connection error:', err);
  }

  try {
    const s = await sessionService.getOrCreateSession('+919876543210');
    console.log('Session retrieved:', s);
  } catch (err) {
    console.error('Session retrieve error:', err);
  }
  
  await pool.end();
  console.log('Done');
}

main().catch(console.error);
