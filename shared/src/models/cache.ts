import { ModelOperation } from './types';

export interface ModelCacheConfig {
  enabled: boolean;
  storage?: ModelCacheStorage;
  defaultTTLMs?: number;
  maxSize?: number;
}

export interface ModelCacheStorage {
  get(key: string): Promise<ModelCacheEntry | null>;
  set(key: string, entry: ModelCacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

export interface ModelCacheEntry<T = unknown> {
  key: string;
  value: T;
  operation: ModelOperation;
  modelId: string;
  promptVersion: string;
  inputHash: string;
  createdAt: string;
  expiresAt: string;
  hitCount: number;
}

export class ModelCache {
  private config: ModelCacheConfig;
  private memoryCache: Map<string, ModelCacheEntry> = new Map();
  private defaultTTLMs = 3600000;
  private maxSize = 10000;

  constructor(config: ModelCacheConfig) {
    this.config = {
      enabled: true,
      defaultTTLMs: 3600000,
      maxSize: 10000,
      ...config,
    };
    this.defaultTTLMs = this.config.defaultTTLMs || this.defaultTTLMs;
    this.maxSize = this.config.maxSize || this.maxSize;
  }

  generateKey(operation: ModelOperation, modelId: string, promptVersion: string, inputHash: string): string {
    return `model:${operation}:${modelId}:${promptVersion}:${inputHash}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.config.enabled) return null;

    if (this.config.storage) {
      const entry = await this.config.storage.get(key);
      if (entry && new Date(entry.expiresAt) > new Date()) {
        entry.hitCount++;
        await this.config.storage.set(key, entry);
        return entry.value as T;
      }
      if (entry) {
        await this.config.storage.delete(key);
      }
      return null;
    }

    const entry = this.memoryCache.get(key);
    if (entry && new Date(entry.expiresAt) > new Date()) {
      entry.hitCount++;
      return entry.value as T;
    }
    if (entry) {
      this.memoryCache.delete(key);
    }
    return null;
  }

  async set<T>(key: string, value: T, operation: ModelOperation, modelId: string, promptVersion: string, inputHash: string, ttlMs?: number): Promise<void> {
    if (!this.config.enabled) return;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (ttlMs || this.defaultTTLMs));

    const entry: ModelCacheEntry<T> = {
      key,
      value,
      operation,
      modelId,
      promptVersion,
      inputHash,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      hitCount: 0,
    };

    if (this.config.storage) {
      await this.config.storage.set(key, entry);
    } else {
      if (this.memoryCache.size >= this.maxSize) {
        const oldestKey = this.memoryCache.keys().next().value;
        if (oldestKey) this.memoryCache.delete(oldestKey);
      }
      this.memoryCache.set(key, entry);
    }
  }

  async delete(key: string): Promise<void> {
    if (this.config.storage) {
      await this.config.storage.delete(key);
    } else {
      this.memoryCache.delete(key);
    }
  }

  async clear(): Promise<void> {
    if (this.config.storage) {
      await this.config.storage.clear();
    } else {
      this.memoryCache.clear();
    }
  }

  async size(): Promise<number> {
    if (this.config.storage) {
      return this.config.storage.size();
    }
    return this.memoryCache.size;
  }

  async cleanup(): Promise<number> {
    let removed = 0;
    const now = new Date();

    if (this.config.storage) {
      // Would need storage-specific implementation
    } else {
      for (const [key, entry] of this.memoryCache.entries()) {
        if (new Date(entry.expiresAt) <= now) {
          this.memoryCache.delete(key);
          removed++;
        }
      }
    }
    return removed;
  }

  getStats(): { size: number; maxSize: number; hitRate?: number } {
    let totalHits = 0;
    let totalEntries = 0;

    for (const entry of this.memoryCache.values()) {
      totalHits += entry.hitCount;
      totalEntries++;
    }

    return {
      size: this.memoryCache.size,
      maxSize: this.maxSize,
      hitRate: totalEntries > 0 ? totalHits / totalEntries : undefined,
    };
  }
}

export function createModelCache(config?: Partial<ModelCacheConfig>): ModelCache {
  return new ModelCache({
    enabled: true,
    defaultTTLMs: 3600000,
    maxSize: 10000,
    ...config,
  });
}