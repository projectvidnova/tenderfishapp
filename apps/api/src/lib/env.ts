/**
 * Environment variable validation — runs at startup.
 * Fails fast with clear error messages if required config is missing.
 */
import { z } from "zod";

const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // AI provider selection: "ionos" (default) or "anthropic"
  AI_PROVIDER: z.enum(["ionos", "anthropic"]).default("ionos"),

  // Anthropic (required when AI_PROVIDER=anthropic)
  ANTHROPIC_API_KEY: z.string().optional().transform(v => v === "" ? undefined : v),

  // IONOS AI (required when AI_PROVIDER=ionos)
  IONOS_API_KEY: z.string().optional().transform(v => v === "" ? undefined : v),
  IONOS_AI_BASE_URL: z.string().url().default("https://openai.inference.de-txl.ionos.com/v1"),
  GROQ_API_KEY: z.string().optional().transform(v => v === "" ? undefined : v),
  GROQ_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),

  // Optional with defaults
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),

  // Social login (optional — only needed if you want social sign-in)
  GOOGLE_CLIENT_ID: z.string().optional().transform(v => v === "" ? undefined : v),
  GOOGLE_CLIENT_SECRET: z.string().optional().transform(v => v === "" ? undefined : v),
  MICROSOFT_CLIENT_ID: z.string().optional().transform(v => v === "" ? undefined : v),
  MICROSOFT_CLIENT_SECRET: z.string().optional().transform(v => v === "" ? undefined : v),
  GITHUB_CLIENT_ID: z.string().optional().transform(v => v === "" ? undefined : v),
  GITHUB_CLIENT_SECRET: z.string().optional().transform(v => v === "" ? undefined : v),

  // S3-compatible storage (IONOS Object Storage)
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("de"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().default("tenderfish-dev-files"),

  // CORS
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3002"),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW: z.string().default("15 minutes"),

  // File upload
  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024), // 50MB

  // CORS preflight
  CORS_MAX_AGE_SECONDS: z.coerce.number().int().nonnegative().default(86400), // 24h

  // Signed URLs
  SIGNED_URL_EXPIRY_MS: z.coerce.number().int().positive().default(15 * 60 * 1000), // 15 min

  // AI models (per-provider)
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-20250514"),
  IONOS_AI_MODEL: z.string().default("meta-llama/Meta-Llama-3.1-8B-Instruct"),
  AI_MAX_TOKENS_EXTRACT: z.coerce.number().int().positive().default(4096),
  AI_MAX_TOKENS_CLASSIFY: z.coerce.number().int().positive().default(2048),
  AI_MAX_TOKENS_CHAT: z.coerce.number().int().positive().default(1024),
  AI_FACT_EXTRACTION_MAX_CHARS: z.coerce.number().int().positive().default(100000),
  AI_CLASSIFICATION_MAX_CHARS: z.coerce.number().int().positive().default(50000),

  // Chat
  CHAT_HISTORY_LIMIT: z.coerce.number().int().positive().default(10),

  // Defaults
  DEFAULT_COUNTRY: z.string().default("Germany"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

/**
 * Validate and return typed environment config.
 * Call once at startup; throws with clear messages on invalid config.
 */
export function validateEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `  - ${i.path.join(".")}: ${i.message}`
    );
    console.error(
      `\n❌ Invalid environment configuration:\n${issues.join("\n")}\n`
    );
    process.exit(1);
  }

  _env = result.data;
  return _env;
}

/**
 * Get validated env (must call validateEnv() first at startup).
 */
export function getEnv(): Env {
  if (!_env) {
    return validateEnv();
  }
  return _env;
}
