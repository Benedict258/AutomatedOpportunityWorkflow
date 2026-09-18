import type { RawDocument } from './types';
import type { ExtractionContext, ExtractionResult } from './types';

export interface Extractor {
  /**
   * Unique identifier for the extractor implementation.
   */
  readonly name: string;

  /**
   * Determines if this extractor can handle the given document.
   */
  canHandle(document: RawDocument, context: ExtractionContext): boolean;

  /**
   * Performs extraction on a raw document.
   */
  extract(document: RawDocument, context: ExtractionContext): Promise<ExtractionResult>;

  /**
   * Optional health check or capability metadata.
   */
  getCapabilities?(): {
    contentTypes: string[];
    supportsLLM?: boolean;
    deterministic?: boolean;
  };
}
