import { loadConfig } from './loader';
import type { AppConfig } from './schema';

// Load config once at module initialization
// Validation will throw on startup if config is invalid
export const config: AppConfig = loadConfig();

export { type AppConfig } from './schema';
export { loadConfig } from './loader';
