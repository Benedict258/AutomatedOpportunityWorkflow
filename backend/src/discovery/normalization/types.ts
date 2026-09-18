import { OpportunityStatus, DeadlineType } from '../../../../../shared/src/enums';

export type RemoteStatus = 'REMOTE' | 'HYBRID' | 'ONSITE' | 'FLEXIBLE' | 'UNKNOWN';

export type OpportunityType =
  | 'JOB'
  | 'INTERNSHIP'
  | 'FELLOWSHIP'
  | 'CERTIFICATION'
  | 'EVENT'
  | 'GRADUATE_PROGRAM'
  | 'CONTRACT'
  | 'VOLUNTEER'
  | 'UNKNOWN';

export interface SkillReference {
  name: string;
  normalizedName?: string;
  relationType?: 'REQUIRED' | 'PREFERRED';
  proficiencyContext?: string;
}

export interface EligibilityRequirement {
  type: string;
  value?: string;
  isRequired?: boolean;
  details?: string;
}

export interface CompensationInfo {
  min?: number;
  max?: number;
  currency?: string;
  period?: 'HOURLY' | 'MONTHLY' | 'ANNUAL' | 'STIPEND' | 'UNKNOWN';
  text?: string;
}

export interface NormalizedOpportunity {
  // Canonical identifiers
  source: string;
  externalId?: string;
  stableId?: string;

  // Core fields
  title: string;
  organization?: string;
  description?: string;
  url?: string;

  // Location & remote
  location?: string;
  remoteStatus: RemoteStatus;
  remoteInfo?: Record<string, unknown>;

  // Classification
  opportunityType: OpportunityType;
  category?: string[];
  categoryIds?: string[];
  skills?: SkillReference[];

  // Requirements
  eligibility?: EligibilityRequirement[];
  educationRequirements?: string[];
  experienceRequirements?: string[];

  // Compensation
  compensation?: CompensationInfo;

  // Application
  applicationMethod?: string[];
  applicationUrl?: string;

  // Temporal
  publicationDate?: string; // ISO 8601
  deadline?: string | null; // ISO 8601
  deadlineType: DeadlineType;

  // Metadata
  status?: OpportunityStatus;
  firstSeenAt?: string;
  lastSeenAt?: string;

  // Provenance
  provenance?: {
    extractor?: string;
    normalizedAt?: string;
    confidence?: number;
    warnings?: string[];
  };
}

export interface NormalizationContext {
  sourceId: string;
  documentId: string;
  externalId?: string | string[];
  extractionResult?: {
    fields: Record<string, unknown>;
    confidence: number;
    warnings: unknown[];
    errors: unknown[];
    provenance?: unknown;
  };
  options?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface NormalizationWarning {
  code: string;
  message: string;
  field?: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface NormalizationError {
  code: string;
  message: string;
  field?: string;
  recoverable?: boolean;
}

export interface NormalizationResult {
  normalizedOpportunity: NormalizedOpportunity;
  warnings: NormalizationWarning[];
  errors: NormalizationError[];
  metrics?: {
    normalizedAt: string;
    processingMs: number;
    sourceSchemaVersion?: string;
  };
}
