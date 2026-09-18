import { NormalizedOpportunity, NormalizationContext, NormalizationResult } from './types';

export interface Normalizer {
  /**
   * Normalizes extracted fields from a source-specific schema into the canonical Opportunity domain model.
   * @param extractedFields Raw extracted fields from extraction engine
   * @param context Normalization context including sourceId, documentId, and metadata
   * @returns Normalized opportunity with warnings/errors
   */
  normalize(
    extractedFields: Record<string, unknown>,
    context: NormalizationContext
  ): Promise<NormalizationResult> | NormalizationResult;

  /**
   * Validates whether this normalizer can handle the given source.
   * @param sourceId Source identifier
   * @returns true if supported
   */
  supports(sourceId: string): boolean;

  /**
   * Returns the source Ids this normalizer handles.
   */
  getSupportedSources?(): string[];
}
