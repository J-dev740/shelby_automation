import { z } from 'zod';
import * as dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  META_VERIFY_TOKEN: z.string().default('shelby_test_token'),
  META_API_TOKEN: z.string().optional(),
  META_PHONE_ID: z.string().optional(),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@127.0.0.1:54322/postgres'),
  REDIS_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);

// --- STRICT ENVIRONMENT GUARDRAILS ---

// Prevent development environments from connecting to production Supabase databases
if (env.NODE_ENV === 'development' && env.DATABASE_URL.includes('supabase.co')) {
  throw new Error("🚨 SECURITY BREACH: Attempted to connect to production Supabase from a development environment. Halting!");
}

// Ensure production environments have required Meta configuration
if (env.NODE_ENV === 'production' && (!env.META_API_TOKEN || !env.META_PHONE_ID)) {
  throw new Error("🚨 STARTUP FAILED: META_API_TOKEN and META_PHONE_ID are required in production.");
}
