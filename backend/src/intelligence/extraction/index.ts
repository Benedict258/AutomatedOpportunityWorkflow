/**
 * Intelligence Extraction Module
 * 
 * Model-backed extraction with deterministic fallback for opportunity documents.
 * Integrates with unified model service and provides full provenance tracking.
 */

export * from './types';
export * from './extraction-engine';
export * from './prompt-v1';
export * from './validator';

import { ExtractionEngine } from './extraction-engine';
import { UnifiedModelService } from 'shared/models/unified-service';
import { DeterministicExtractor } from '../../discovery/extraction/deterministic-extractor';
import type { ExtractionEngineConfig } from './types';

/**
 * Factory function to create a configured extraction engine
 */
export function createExtractionEngine(
  unifiedModelService: UnifiedModelService,
  config?: Partial<ExtractionEngineConfig>
): ExtractionEngine {
  const deterministicExtractor = new DeterministicExtractor();
  
  return new ExtractionEngine({
    unifiedModelService,
    deterministicExtractor,
    defaultPromptVersion: config?.defaultPromptVersion || 'v1',
    defaultConfidenceThreshold: config?.defaultConfidenceThreshold || 0.7,
    defaultTimeoutMs: config?.defaultTimeoutMs || 30000,
    maxRetries: config?.maxRetries || 2,
    enableObservability: config?.enableObservability ?? true
  });
}

/**
 * Default extraction engine instance (lazy initialization)
 */
let defaultEngine: ExtractionEngine | null = null;

export function getDefaultExtractionEngine(
  unifiedModelService: UnifiedModelService
): ExtractionEngine {
  if (!defaultEngine) {
    defaultEngine = createExtractionEngine(unifiedModelService);
  }
  return defaultEngine;
}

export function resetDefaultExtractionEngine(): void {
  defaultEngine = null;
}