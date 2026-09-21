import { loadConfig } from './loader';
import type { AppConfig } from './schema';
import { loadModelRegistryConfig, createDefaultConfig } from './model-loader';

// Load app config once at module initialization
export const config: AppConfig = (() => {
  try {
    return loadConfig();
  } catch {
    // Return a safe default so the module still loads even if YAML config is missing/invalid
    return {
      app: { name: 'automated-opportunity-workflow', version: '0.1.0' },
      matching: {
        weights: { semantic: 0.4, taxonomy: 0.3, recency: 0.2, source_trust: 0.1 },
        thresholds: { min_score: 0.6, high_confidence: 0.85 },
      },
      sources: { enabled: ['usajobs'], max_items_per_source: 100, freshness_days: 30 },
      notifications: {
        schedule: { enabled: true, timezone: 'UTC', batch_times: ['09:00'] },
        channels: { email: false, slack: false },
      },
      feature_flags: { extraction_enabled: true, classification_enabled: true, matching_enabled: true, notification_enabled: true },
      opportunity_limits: { max_per_user: 50, max_batch_size: 100 },
      freshness: { stale_days: 60, archive_days: 365 },
      retry: { max_attempts: 3, base_delay_ms: 1000, backoff_factor: 2 },
    } as AppConfig;
  }
})();

// Load model registry config
export const modelConfig: ReturnType<typeof loadModelRegistryConfig> = (() => {
  try {
    return loadModelRegistryConfig();
  } catch {
    return createDefaultConfig();
  }
})();

export { type AppConfig } from './schema';
export { loadConfig } from './loader';
export { loadModelRegistryConfig, createDefaultConfig } from './model-loader';