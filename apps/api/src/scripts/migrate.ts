import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, pool } from '../lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In src/scripts, root is 3 levels up
const rootDir = path.resolve(__dirname, '../../../..');
const migrationsDir = path.join(rootDir, 'supabase', 'migrations');

async function runMigrations() {
  console.log(`[Migration] Starting database migrations...`);
  
  try {
    // 1. Create a migrations table to track applied migrations
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Get list of applied migrations
    const appliedRes = await db.query(`SELECT filename FROM schema_migrations`);
    const applied = new Set(appliedRes.rows.map(r => r.filename));

    // 3. Get all .sql files from supabase/migrations
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[Migration] Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`[Migration] Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      
      // Execute the migration script
      await db.query(sql);

      // Record it as applied
      await db.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
      console.log(`[Migration] Successfully applied ${file}`);
    }

    console.log(`[Migration] All migrations completed successfully.`);
  } catch (error) {
    console.error(`[Migration] Error running migrations:`, error);
    process.exit(1);
  } finally {
    // DO NOT pool.end() if we are going to continue running the app
    // But since this is a standalone script, we must end it.
    await pool.end();
  }
}

runMigrations();
