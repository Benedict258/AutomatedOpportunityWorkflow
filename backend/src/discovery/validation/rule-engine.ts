import { ValidationRule, ValidationContext, ValidationIssue, ValidationSeverity } from './types';
import { NormalizedOpportunity, OpportunityType } from '../normalization/types';

const VALID_OPPORTUNITY_TYPES: OpportunityType[] = [
  'JOB',
  'INTERNSHIP',
  'FELLOWSHIP',
  'CERTIFICATION',
  'EVENT',
  'GRADUATE_PROGRAM',
  'CONTRACT',
  'VOLUNTEER',
  'UNKNOWN',
];

const REQUIRED_FIELDS: (keyof NormalizedOpportunity)[] = [
  'source',
  'title',
  'opportunityType',
  'remoteStatus',
  'deadlineType',
];

function isValidISODate(value?: string): boolean {
  if (!value) return true;
  const date = new Date(value);
  return !isNaN(date.getTime()) && value === new Date(date.toISOString()).toISOString().slice(0, 24);
}

function isValidUrl(value?: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getValidationIssue(
  code: string,
  message: string,
  field?: string,
  severity: ValidationSeverity = 'ERROR',
  remediation?: string
): ValidationIssue {
  return { code, message, field, severity, remediation };
}

export const requiredFieldsRule: ValidationRule = {
  id: 'required-fields',
  name: 'Required Fields Presence',
  description: 'Ensures mandatory canonical fields are present and non-empty',
  severity: 'ERROR',
  check: (ctx: ValidationContext) => {
    const opp = ctx.opportunity;
    for (const field of REQUIRED_FIELDS) {
      const value = opp[field];
      if (value === undefined || value === null || value === '') {
        return getValidationIssue(
          'MISSING_REQUIRED_FIELD',
          `Required field '${String(field)}' is missing or empty`,
          String(field),
          'ERROR',
          `Populate '${String(field)}' from source mapping before validation`
        );
      }
    }
    return null;
  },
};

export const titleLengthRule: ValidationRule = {
  id: 'title-length',
  name: 'Title Length',
  severity: 'WARNING',
  check: (ctx) => {
    const title = ctx.opportunity.title?.trim() ?? '';
    if (title.length < 3) {
      return getValidationIssue(
        'TITLE_TOO_SHORT',
        `Title is too short (${title.length} chars)`,
        'title',
        'ERROR',
        'Provide a more descriptive title from source'
      );
    }
    if (title.length > 200) {
      return getValidationIssue(
        'TITLE_TOO_LONG',
        `Title exceeds 200 characters (${title.length})`,
        'title',
        'WARNING',
        'Truncate or shorten title to improve readability'
      );
    }
    return null;
  },
};

export const descriptionLengthRule: ValidationRule = {
  id: 'description-length',
  name: 'Description Length',
  severity: 'WARNING',
  check: (ctx) => {
    const desc = ctx.opportunity.description?.trim() ?? '';
    if (!desc) {
      return getValidationIssue(
        'DESCRIPTION_MISSING',
        'Description is missing',
        'description',
        'WARNING',
        'Extract description from source if available'
      );
    }
    if (desc.length < 10) {
      return getValidationIssue(
        'DESCRIPTION_TOO_SHORT',
        `Description is too short (${desc.length} chars)`,
        'description',
        'WARNING',
        'Enrich description with additional source content'
      );
    }
    if (desc.length > 5000) {
      return getValidationIssue(
        'DESCRIPTION_TOO_LONG',
        `Description exceeds 5000 characters (${desc.length})`,
        'description',
        'WARNING',
        'Summarize description or store full text in separate field'
      );
    }
    return null;
  },
};

export const dateValidityRule: ValidationRule = {
  id: 'date-validity',
  name: 'Date Validity',
  severity: 'ERROR',
  check: (ctx) => {
    const opp = ctx.opportunity;
    const dates: Array<{field: keyof NormalizedOpportunity; value?: string}> = [
      { field: 'publicationDate', value: opp.publicationDate },
      { field: 'deadline', value: opp.deadline ?? undefined },
      { field: 'firstSeenAt', value: opp.firstSeenAt },
      { field: 'lastSeenAt', value: opp.lastSeenAt },
    ];
    for (const { field, value } of dates) {
      if (value && !isValidISODate(value)) {
        return getValidationIssue(
          'INVALID_DATE_FORMAT',
          `Field '${String(field)}' is not a valid ISO 8601 date: ${value}`,
          String(field),
          'ERROR',
          'Normalize date to ISO 8601 UTC format'
        );
      }
    }
    if (opp.deadline && opp.publicationDate && opp.deadline < opp.publicationDate) {
      return getValidationIssue(
        'DEADLINE_BEFORE_PUBLICATION',
        'Deadline precedes publication date',
        'deadline',
        'WARNING',
        'Verify deadline and publication date correctness'
      );
    }
    return null;
  },
};

export const urlValidityRule: ValidationRule = {
  id: 'url-validity',
  name: 'URL Validity',
  severity: 'WARNING',
  check: (ctx) => {
    const opp = ctx.opportunity;
    if (opp.url && !isValidUrl(opp.url)) {
      return getValidationIssue(
        'INVALID_URL',
        `URL is malformed: ${opp.url}`,
        'url',
        'WARNING',
        'Correct URL or remove if source does not provide valid link'
      );
    }
    if (opp.applicationUrl && !isValidUrl(opp.applicationUrl)) {
      return getValidationIssue(
        'INVALID_APPLICATION_URL',
        `Application URL is malformed: ${opp.applicationUrl}`,
        'applicationUrl',
        'WARNING',
        'Correct application URL'
      );
    }
    return null;
  },
};

export const canonicalFormatRule: ValidationRule = {
  id: 'canonical-format',
  name: 'Canonical Format',
  severity: 'ERROR',
  check: (ctx) => {
    const opp = ctx.opportunity;
    if (!opp.source) {
      return getValidationIssue('MISSING_SOURCE', 'Source identifier missing', 'source', 'ERROR');
    }
    if (opp.externalId && typeof opp.externalId !== 'string') {
      return getValidationIssue('INVALID_EXTERNAL_ID', 'externalId must be string', 'externalId', 'ERROR');
    }
    if (opp.stableId && !/^[a-zA-Z0-9_-]+$/.test(opp.stableId)) {
      return getValidationIssue(
        'INVALID_STABLE_ID_FORMAT',
        'stableId contains invalid characters',
        'stableId',
        'WARNING',
        'Use alphanumeric, hyphen, underscore only for stableId'
      );
    }
    return null;
  },
};

export const deduplicationReadinessRule: ValidationRule = {
  id: 'deduplication-readiness',
  name: 'Deduplication Readiness',
  severity: 'WARNING',
  check: (ctx) => {
    const opp = ctx.opportunity;
    const hasTitle = !!opp.title?.trim();
    const hasOrg = !!opp.organization?.trim();
    const hasUrl = !!opp.url?.trim();
    if (!hasTitle || !hasOrg || !hasUrl) {
      return getValidationIssue(
        'DEDUP_INSUFFICIENT_SIGNALS',
        'Missing key fields for deduplication fingerprint (title, organization, url)',
        'title',
        'WARNING',
        'Ensure title, organization, and url are populated for reliable deduplication'
      );
    }
    return null;
  },
};

export const taxonomyConformanceRule: ValidationRule = {
  id: 'taxonomy-conformance',
  name: 'Taxonomy Conformance',
  severity: 'ERROR',
  check: (ctx) => {
    const opp = ctx.opportunity;
    if (!VALID_OPPORTUNITY_TYPES.includes(opp.opportunityType)) {
      return getValidationIssue(
        'INVALID_OPPORTUNITY_TYPE',
        `opportunityType '${opp.opportunityType}' is not in taxonomy`,
        'opportunityType',
        'ERROR',
        `Map opportunityType to one of: ${VALID_OPPORTUNITY_TYPES.join(', ')}`
      );
    }
    if (opp.categoryIds && !Array.isArray(opp.categoryIds)) {
      return getValidationIssue(
        'INVALID_CATEGORY_IDS',
        'categoryIds must be an array',
        'categoryIds',
        'ERROR'
      );
    }
    return null;
  },
};

export const defaultValidationRules: ValidationRule[] = [
  requiredFieldsRule,
  titleLengthRule,
  descriptionLengthRule,
  dateValidityRule,
  urlValidityRule,
  canonicalFormatRule,
  deduplicationReadinessRule,
  taxonomyConformanceRule,
];
