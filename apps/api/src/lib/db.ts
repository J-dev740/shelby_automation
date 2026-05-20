import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

// We will use standard Postgres connection string
// For local Supabase, this is usually: postgresql://postgres:postgres@localhost:54322/postgres
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Recommended settings for serverless / queue workers
  max: 20, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = {
  async query(text: string, params?: any[]) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`[DB] executed query`, { text, duration, rows: res.rowCount });
    return res;
  },
  async getClient() {
    const client = await pool.connect();
    return client;
  }
};
