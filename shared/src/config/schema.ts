import { z } from 'zod';

export const AppConfigSchema = z.object({
  app: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
  }),
  matching: z.object({
    weights: z.object({
      semantic: z.number().min(0).max(1),
      taxonomy: z.number().min(0).max(1),
      recency: z.number().min(0).max(1),
      source_trust: z.number().min(0).max(1),
    }),
    thresholds: z.object({
      min_score: z.number().min(0).max(1),
      high_confidence: z.number().min(0).max(1),
    }),
  }),
  sources: z.object({
    enabled: z.array(z.string()).min(1),
    max_items_per_source: z.number().int().positive(),
    freshness_days: z.number().int().positive(),
  }),
  notifications: z.object({
    schedule: z.object({
      enabled: z.boolean(),
      timezone: z.string().min(1),
      batch_times: z.array(z.string()),
    }),
    channels: z.object({
      email: z.boolean(),
      slack: z.boolean(),
    }),
  }),
  feature_flags: z.object({
    extraction_enabled: z.boolean(),
    classification_enabled: z.boolean(),
    matching_enabled: z.boolean(),
    notification_enabled: z.boolean(),
  }),
  opportunity_limits: z.object({
    max_per_user: z.number().int().positive(),
    max_batch_size: z.number().int().positive(),
  }),
  freshness: z.object({
    stale_days: z.number().int().positive(),
    archive_days: z.number().int().positive(),
  }),
  retry: z.object({
    max_attempts: z.number().int().positive(),
    base_delay_ms: z.number().int().positive(),
    backoff_factor: z.number().positive(),
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
