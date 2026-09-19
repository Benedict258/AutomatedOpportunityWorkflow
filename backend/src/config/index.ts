import { loadEnv, getEnv, type Env } from './env.js';

export { loadEnv, getEnv, type Env };

export const config = {
  get env(): Env {
    return getEnv();
  },
  
  get server() {
    const env = getEnv();
    return {
      host: env.HOST,
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
    };
  },

  get database() {
    const env = getEnv();
    return {
      url: env.DATABASE_URL,
      poolSize: env.DATABASE_POOL_SIZE,
      ssl: env.DATABASE_SSL,
    };
  },

  get jwt() {
    const env = getEnv();
    return {
      secret: env.JWT_SECRET,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: env.JWT_EXPIRES_IN,
    };
  },

  get apiKey() {
    const env = getEnv();
    return {
      header: env.API_KEY_HEADER,
      prefix: env.API_KEY_PREFIX,
    };
  },

  get webhook() {
    const env = getEnv();
    return {
      hmacSecret: env.WEBHOOK_HMAC_SECRET,
      hmacHeader: env.WEBHOOK_HMAC_HEADER,
    };
  },

  get rateLimit() {
    const env = getEnv();
    return {
      max: env.RATE_LIMIT_MAX,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
    };
  },

  get cors() {
    const env = getEnv();
    return {
      origin: env.CORS_ORIGIN,
    };
  },

  get logging() {
    const env = getEnv();
    return {
      level: env.LOG_LEVEL,
      pretty: env.LOG_PRETTY,
    };
  },

  get swagger() {
    const env = getEnv();
    return {
      enabled: env.SWAGGER_ENABLED,
      path: env.SWAGGER_PATH,
    };
  },

  get idempotency() {
    const env = getEnv();
    return {
      ttlMs: env.IDEMPOTENCY_TTL_MS,
    };
  },

  get healthCheck() {
    const env = getEnv();
    return {
      timeoutMs: env.HEALTH_CHECK_TIMEOUT_MS,
    };
  },
};