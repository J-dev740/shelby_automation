import { z } from 'zod';
import * as dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@127.0.0.1:54322/postgres'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
}).superRefine((data, ctx) => {
  // Guard: dev must not connect to production Supabase
  if (data.NODE_ENV !== 'production' && data.DATABASE_URL.includes('supabase.co')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Dev must not connect to production Supabase' });
  }
  // Guard: production requires explicit DATABASE_URL
  if (data.NODE_ENV === 'production' && data.DATABASE_URL.includes('127.0.0.1')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'DATABASE_URL must be set in production' });
  }
});

export const env = envSchema.parse(process.env);
