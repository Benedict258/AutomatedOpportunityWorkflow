import { z } from 'zod';

export const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().url().or(z.string().min(1)),
  DATABASE_POOL_SIZE: z.coerce.number().default(10),
  DATABASE_SSL: z.coerce.boolean().default(false),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('automated-opportunity-workflow'),
  JWT_AUDIENCE: z.string().default('api.automated-opportunity-workflow'),
  JWT_EXPIRES_IN: z.string().default('1h'),

  // API Key
  API_KEY_HEADER: z.string().default('X-API-Key'),
  API_KEY_PREFIX: z.string().default('aow_'),

  // Webhook HMAC
  WEBHOOK_HMAC_SECRET: z.string().min(32),
  WEBHOOK_HMAC_HEADER: z.string().default('X-Webhook-Signature'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(false),

  // Swagger
  SWAGGER_ENABLED: z.coerce.boolean().default(true),
  SWAGGER_PATH: z.string().default('/docs'),

  // Idempotency
  IDEMPOTENCY_TTL_MS: z.coerce.number().default(86400000), // 24 hours

  // Health checks
  HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().default(5000),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Environment validation failed:');
    console.error(result.error.format());
    throw new Error('Invalid environment configuration');
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getEnv(): Env {
  if (!cachedEnv) {
    return loadEnv();
  }
  return cachedEnv;
}