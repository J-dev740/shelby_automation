import { z } from 'zod';
import * as dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  // Meta WhatsApp
  META_VERIFY_TOKEN: z.string().default('shelby_test_token'),
  META_API_TOKEN: z.string().optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),

  // Flow Settings (Optional to allow local dev without flow setup)
  FLOW_ID: z.string().optional(),
  FLOW_PRIVATE_KEY: z.string().optional(),

  META_PHONE_ID: z.string().optional(),
  META_API_VERSION: z.string().default('v25.0'),
  META_BUSINESS_ACCOUNT_ID: z.string().optional(),
  META_TEST_RECIPIENT: z.string().optional(),
  MESSAGING_PROVIDER: z.enum(['meta', 'mock']).default('mock'),
  // Infrastructure
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@127.0.0.1:54322/postgres'),
  REDIS_URL: z.string().optional(),
  // Upstash Redis (HTTP REST — for rate limiting & serverless-safe usage)
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  // Payments
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  // Webhooks
  SUPABASE_WEBHOOK_SECRET: z.string().optional(),
}).superRefine((data, ctx) => {
  // Guard: dev must not connect to production Supabase
  if (data.NODE_ENV !== 'production' && data.DATABASE_URL.includes('supabase.co')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Dev must not connect to production Supabase' });
  }
  // Guard: production requires Meta tokens
  if (data.NODE_ENV === 'production') {
    if (!data.META_API_TOKEN) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'META_API_TOKEN required in production' });
    if (!data.META_PHONE_ID) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'META_PHONE_ID required in production' });
    if (!data.REDIS_URL) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'REDIS_URL required in production for message durability' });
    if (!data.UPSTASH_REDIS_REST_URL) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'UPSTASH_REDIS_REST_URL required in production for rate limiting' });
    if (!data.UPSTASH_REDIS_REST_TOKEN) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'UPSTASH_REDIS_REST_TOKEN required in production for rate limiting' });
  }
  // Guard: meta provider requires tokens
  if (data.MESSAGING_PROVIDER === 'meta') {
    if (!data.META_API_TOKEN) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'META_API_TOKEN required when MESSAGING_PROVIDER=meta' });
    if (!data.META_PHONE_ID) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'META_PHONE_ID required when MESSAGING_PROVIDER=meta' });
  }
});

export const env = envSchema.parse(process.env);
