import { loadConfig } from './loader';
import type { AppConfig } from './schema';
import { loadModelRegistryConfig, createDefaultConfig } from './model-loader';

// Load app config once at module initialization
export const config: AppConfig = loadConfig();

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