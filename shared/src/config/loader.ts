import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { AppConfigSchema, type AppConfig } from './schema';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function deepMerge(target: any, source: any): any {
  if (typeof target !== 'object' || target === null) return source;
  if (typeof source !== 'object' || source === null) return target;

  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (Array.isArray(source[key])) {
      output[key] = source[key];
    } else if (typeof source[key] === 'object') {
      output[key] = deepMerge(target[key] ?? {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

function loadYamlFile(filePath: string): any {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return yaml.load(content) as any;
  } catch (err) {
    throw new Error(`Failed to load YAML config from ${filePath}: ${(err as Error).message}`);
  }
}

export function loadConfig(): AppConfig {
  const configDir = path.resolve(__dirname, '../../config');
  const env = process.env.NODE_ENV ?? 'development';

  const defaultPath = path.join(configDir, 'default.yaml');
  const envPath = path.join(configDir, `${env}.yaml`);

  const defaultConfig = loadYamlFile(defaultPath);
  const envConfig = loadYamlFile(envPath);

  const merged = deepMerge(defaultConfig, envConfig);

  // Validate
  const result = AppConfigSchema.safeParse(merged);
  if (!result.success) {
    const errors = result.error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  // Optional environment variable overrides for business config
  // Example: CONFIG_MATCHING_THRESHOLDS_MIN_SCORE=0.7
  const envOverrides: DeepPartial<AppConfig> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('CONFIG_')) continue;
    // Convert CONFIG_MATCHING_THRESHOLDS_MIN_SCORE to path matching.thresholds.min_score
    const pathParts = key
      .replace(/^CONFIG_/, '')
      .toLowerCase()
      .split('_')
      .map((p, i) => i === 0 ? p : p);
    // Navigate and set value with type coercion
    let current: any = envOverrides;
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      current[part] = current[part] ?? {};
      current = current[part];
    }
    const lastPart = pathParts[pathParts.length - 1];
    // Simple coercion
    if (value === 'true') current[lastPart] = true;
    else if (value === 'false') current[lastPart] = false;
    else if (!isNaN(Number(value))) current[lastPart] = Number(value);
    else current[lastPart] = value;
  }

  const finalConfig = deepMerge(merged, envOverrides);

  const finalResult = AppConfigSchema.safeParse(finalConfig);
  if (!finalResult.success) {
    const errors = finalResult.error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed after env overrides:\n${errors}`);
  }

  return finalResult.data;
}
