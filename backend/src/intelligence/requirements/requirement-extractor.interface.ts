import { RequirementExtractionResult } from './types';

export interface IRequirementExtractor {
  /**
   * Extract requirements from raw text deterministically.
   * No LLM calls - pattern based only.
   */
  extract(text: string, sourceId: string, context?: Record<string, unknown>): Promise<RequirementExtractionResult>;

  /**
   * Extract requirements from structured sections (e.g., parsed HTML sections).
   */
  extractFromSections(sections: Record<string, string>, sourceId: string): Promise<RequirementExtractionResult>;
}
