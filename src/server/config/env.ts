import { z } from 'zod';

/**
 * Validated server environment. Next.js loads `.env.local` (local) and the
 * Vercel project env (prod) into process.env. loadEnv() is lazy — it only
 * validates when a server route/pipeline actually runs, so the marketing pages
 * and auth (NEXT_PUBLIC_* only) work even if these aren't set yet.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),

  // Public base URL of the deployed app (for links in delivery emails).
  APP_BASE_URL: z.string().default(''),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),

  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),

  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),

  ADMIN_API_SECRET: z.string().min(1),

  // AI providers (§3, §7).
  MODEL_TIER: z.enum(['cost', 'quality']).default('cost'),
  OPENAI_API_KEY: z.string().min(1), // stories (quality) + moderation (always)
  GEMINI_API_KEY: z.string().min(1), // illustrations
  ELEVENLABS_API_KEY: z.string().default(''), // audio tiers only

  MAX_IMAGE_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(2),
  PREVIEW_DAILY_CAP: z.coerce.number().int().min(1).default(10),
  PREVIEW_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),

  INNGEST_EVENT_KEY: z.string().default(''),
  INNGEST_SIGNING_KEY: z.string().default(''),

  SENTRY_DSN: z.string().default(''),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
