import { NormalizedOpportunity } from '../normalization/types';

export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface ValidationIssue {
  code: string;
  message: string;
  field?: keyof NormalizedOpportunity | string;
  severity: ValidationSeverity;
  remediation?: string;
}

export interface ValidationContext {
  opportunity: NormalizedOpportunity;
  sourceId: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}

export interface ValidationRule {
  id: string;
  name: string;
  description?: string;
  severity: ValidationSeverity;
  check: (ctx: ValidationContext) => ValidationIssue | null;
}

export interface ValidationResult {
  opportunityId: string;
  sourceId: string;
  valid: boolean;
  passed: boolean;
  score?: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
  remediationSuggestions: string[];
  checkedAt: string;
  rulesExecuted: number;
}
