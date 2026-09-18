import { IRequirementExtractor } from './requirement-extractor.interface';
import { DeterministicRequirementParser } from './deterministic-requirement-parser';
import { RequirementExtractionResult, RequirementType, RequirementRelationship } from './types';

export class RequirementIntelligenceEngine implements IRequirementExtractor {
  private parser: DeterministicRequirementParser;

  constructor(parser?: DeterministicRequirementParser) {
    this.parser = parser ?? new DeterministicRequirementParser();
  }

  async extract(text: string, sourceId: string, context?: Record<string, unknown>): Promise<RequirementExtractionResult> {
    if (!text || text.trim().length === 0) {
      return this.emptyResult(sourceId);
    }

    const requirements = this.parser.parse(text, sourceId, context?.section as string | undefined);

    return this.buildResult(requirements, sourceId);
  }

  async extractFromSections(sections: Record<string, string>, sourceId: string): Promise<RequirementExtractionResult> {
    const requirements = this.parser.parseSections(sections, sourceId);
    return this.buildResult(requirements, sourceId);
  }

  private buildResult(requirements: any[], sourceId: string): RequirementExtractionResult {
    const byType = {} as Record<RequirementType, number>;
    const byRelationship = {} as Record<RequirementRelationship, number>;

    for (const t of Object.values(RequirementType)) {
      byType[t as RequirementType] = 0;
    }
    for (const r of Object.values(RequirementRelationship)) {
      byRelationship[r as RequirementRelationship] = 0;
    }

    for (const req of requirements) {
      byType[req.type] = (byType[req.type] ?? 0) + 1;
      byRelationship[req.relationship] = (byRelationship[req.relationship] ?? 0) + 1;
    }

    // Deduplicate by normalized value within same type
    const dedupedMap = new Map<string, any>();
    for (const req of requirements) {
      const key = `${req.type}::${req.normalizedValue}`;
      if (!dedupedMap.has(key)) {
        dedupedMap.set(key, req);
      } else {
        const existing = dedupedMap.get(key);
        // Merge provenance
        existing.provenance.push(...req.provenance);
        // Keep strongest relationship
        if (this.relationshipStrength(req.relationship) > this.relationshipStrength(existing.relationship)) {
          existing.relationship = req.relationship;
        }
      }
    }

    const deduped = Array.from(dedupedMap.values());

    return {
      requirements: deduped,
      summary: { byType, byRelationship },
      sourceId,
      extractedAt: new Date().toISOString(),
    };
  }

  private emptyResult(sourceId: string): RequirementExtractionResult {
    const byType = {} as Record<RequirementType, number>;
    const byRelationship = {} as Record<RequirementRelationship, number>;
    for (const t of Object.values(RequirementType)) byType[t as RequirementType] = 0;
    for (const r of Object.values(RequirementRelationship)) byRelationship[r as RequirementRelationship] = 0;

    return {
      requirements: [],
      summary: { byType, byRelationship },
      sourceId,
      extractedAt: new Date().toISOString(),
    };
  }

  private relationshipStrength(rel: RequirementRelationship): number {
    switch (rel) {
      case RequirementRelationship.REQUIRED: return 4;
      case RequirementRelationship.PREFERRED: return 3;
      case RequirementRelationship.INFERRED: return 2;
      case RequirementRelationship.OPTIONAL: return 1;
      default: return 0;
    }
  }
}
