export enum RequirementType {
  SKILL = 'SKILL',
  TECHNOLOGY = 'TECHNOLOGY',
  CERTIFICATION = 'CERTIFICATION',
  EDUCATION = 'EDUCATION',
  EXPERIENCE = 'EXPERIENCE',
  LOCATION = 'LOCATION',
  CITIZENSHIP = 'CITIZENSHIP',
  WORK_AUTHORIZATION = 'WORK_AUTHORIZATION',
  CLEARANCE = 'CLEARANCE',
  LANGUAGE = 'LANGUAGE',
}

export enum RequirementRelationship {
  REQUIRED = 'REQUIRED',
  PREFERRED = 'PREFERRED',
  OPTIONAL = 'OPTIONAL',
  INFERRED = 'INFERRED',
  UNKNOWN = 'UNKNOWN',
}

export enum RequirementConfidence {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export interface RequirementProvenance {
  source: string;
  section?: string;
  snippet: string;
  startIndex?: number;
  endIndex?: number;
}

export interface Requirement {
  id: string;
  type: RequirementType;
  value: string;
  normalizedValue?: string;
  relationship: RequirementRelationship;
  confidence: RequirementConfidence | number;
  provenance: RequirementProvenance[];
  metadata?: Record<string, unknown>;
  extractedAt: string;
}

export interface RequirementExtractionResult {
  requirements: Requirement[];
  summary: {
    byType: Record<RequirementType, number>;
    byRelationship: Record<RequirementRelationship, number>;
  };
  sourceId: string;
  extractedAt: string;
}
