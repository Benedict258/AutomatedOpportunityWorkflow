/**
 * Extraction Output Validator
 * 
 * Validates model extraction output against JSON schema and business rules
 */

import type { ExtractedFields, ExtractionResult, ValidationResult, ExtractionWarning, ExtractionError } from './types';
import { EXTRACTION_JSON_SCHEMA } from './prompt-v1';

/**
 * Expected field types for validation
 */
const FIELD_TYPE_SCHEMA: Record<string, { type: string; required?: boolean; enum?: string[]; format?: string; minimum?: number; maximum?: number; pattern?: string; items?: { type: string } }> = {
  title: { type: 'string', required: true },
  organization: { type: 'string', required: true },
  description: { type: 'string' },
  opportunityType: { type: 'string', enum: ['job', 'internship', 'fellowship', 'contract', 'volunteer', 'research', 'scholarship', 'other'] },
  location: { type: 'string' },
  remoteStatus: { type: 'string', enum: ['remote', 'hybrid', 'onsite', 'unknown'] },
  deadline: { type: 'string', format: 'date' },
  postedDate: { type: 'string', format: 'date' },
  startDate: { type: 'string', format: 'date' },
  endDate: { type: 'string', format: 'date' },
  salaryMin: { type: 'number', minimum: 0 },
  salaryMax: { type: 'number', minimum: 0 },
  salaryCurrency: { type: 'string', pattern: '^[A-Z]{3}$' },
  salaryPeriod: { type: 'string', enum: ['yearly', 'monthly', 'hourly', 'unknown'] },
  equity: { type: 'string' },
  benefits: { type: 'array', items: { type: 'string' } },
  experienceLevel: { type: 'string' },
  experienceYearsMin: { type: 'number', minimum: 0, maximum: 50 },
  experienceYearsMax: { type: 'number', minimum: 0, maximum: 50 },
  educationLevel: { type: 'string' },
  requiredSkills: { type: 'array', items: { type: 'string' } },
  preferredSkills: { type: 'array', items: { type: 'string' } },
  certifications: { type: 'array', items: { type: 'string' } },
  securityClearance: { type: 'string' },
  citizenshipRequired: { type: 'array', items: { type: 'string' } },
  workAuthorization: { type: 'array', items: { type: 'string' } },
  applicationUrl: { type: 'string', format: 'uri' },
  contactEmail: { type: 'string', format: 'email' },
  sourceUrl: { type: 'string', format: 'uri' },
  externalIds: { type: 'object' },
};

/**
 * Validation result
 */
export interface ValidationReport {
  valid: boolean;
  fieldResults: ValidationResult[];
  errors: string[];
  warnings: string[];
  summary: {
    totalFields: number;
    validFields: number;
    invalidFields: number;
    requiredMissing: number;
  };
}

/**
 * Validate extraction output against schema
 */
export function validateExtraction(
  fields: ExtractedFields,
  options: { strictMode?: boolean } = {}
): ValidationReport {
  const fieldResults: ValidationResult[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  for (const [fieldName, schema] of Object.entries(FIELD_TYPE_SCHEMA)) {
    const extractedField = fields[fieldName];
    const isRequired = schema.required === true;

    if (!extractedField) {
      if (isRequired) {
        fieldResults.push({
          field: fieldName,
          valid: false,
          errors: [`Required field '${fieldName}' is missing`],
          warnings: []
        });
        errors.push(`Missing required field: ${fieldName}`);
      }
      continue;
    }

    // Validate field value
    const result = validateField(fieldName, extractedField.value, schema);
    fieldResults.push({
      field: fieldName,
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings
    });

    if (!result.valid) {
      errors.push(...result.errors.map(e => `${fieldName}: ${e}`));
    }
    warnings.push(...result.warnings.map(w => `${fieldName}: ${w}`));
  }

  // Check for unknown fields (not in schema)
  for (const fieldName of Object.keys(fields)) {
    if (!FIELD_TYPE_SCHEMA[fieldName]) {
      warnings.push(`Unknown field '${fieldName}' - not in standard schema`);
    }
  }

  // Cross-field validation
  const crossFieldWarnings = validateCrossFields(fields);
  warnings.push(...crossFieldWarnings);

  const validFields = fieldResults.filter(r => r.valid).length;
  const invalidFields = fieldResults.filter(r => !r.valid).length;
  const requiredMissing = fieldResults.filter(r => !r.valid && FIELD_TYPE_SCHEMA[r.field]?.required).length;

  return {
    valid: errors.length === 0,
    fieldResults,
    errors,
    warnings,
    summary: {
      totalFields: Object.keys(fields).length,
      validFields,
      invalidFields,
      requiredMissing
    }
  };
}

/**
 * Validate a single field against its schema
 */
function validateField(
  fieldName: string,
  value: unknown,
  schema: { type: string; enum?: string[]; minimum?: number; maximum?: number; pattern?: string; format?: string; items?: { type: string } }
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Type validation
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`Expected string, got ${typeof value}`);
      } else {
        // Enum validation
        if (schema.enum && !schema.enum.includes(value)) {
          warnings.push(`Value '${value}' not in expected enum: ${schema.enum.join(', ')}`);
        }
        // Format validation
        if (schema.format === 'date' && !isValidISODate(value)) {
          warnings.push(`Date format may be invalid: ${value}`);
        }
        if (schema.format === 'uri' && !isValidURI(value)) {
          warnings.push(`URI format may be invalid: ${value}`);
        }
        if (schema.format === 'email' && !isValidEmail(value)) {
          warnings.push(`Email format may be invalid: ${value}`);
        }
        // Pattern validation
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
          warnings.push(`Value does not match pattern ${schema.pattern}: ${value}`);
        }
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push(`Expected number, got ${typeof value}`);
      } else {
        if (schema.minimum !== undefined && value < schema.minimum) {
          warnings.push(`Value ${value} below minimum ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          warnings.push(`Value ${value} above maximum ${schema.maximum}`);
        }
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        errors.push(`Expected array, got ${typeof value}`);
      } else if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] !== schema.items.type) {
            warnings.push(`Array item ${i} expected ${schema.items.type}, got ${typeof value[i]}`);
          }
        }
      }
      break;

    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push(`Expected object, got ${typeof value}`);
      }
      break;

    default:
      warnings.push(`Unknown schema type: ${schema.type}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Cross-field validation rules
 */
function validateCrossFields(fields: ExtractedFields): string[] {
  const warnings: string[] = [];

  // Salary min/max consistency
  const min = fields.salaryMin?.value as number | undefined;
  const max = fields.salaryMax?.value as number | undefined;
  if (min !== undefined && max !== undefined && min > max) {
    warnings.push('salaryMin exceeds salaryMax');
  }

  // Experience years consistency
  const expMin = fields.experienceYearsMin?.value as number | undefined;
  const expMax = fields.experienceYearsMax?.value as number | undefined;
  if (expMin !== undefined && expMax !== undefined && expMin > expMax) {
    warnings.push('experienceYearsMin exceeds experienceYearsMax');
  }

  // Date consistency
  const posted = fields.postedDate?.value as string | undefined;
  const deadline = fields.deadline?.value as string | undefined;
  const start = fields.startDate?.value as string | undefined;
  if (posted && deadline && new Date(posted) > new Date(deadline)) {
    warnings.push('postedDate is after deadline');
  }
  if (posted && start && new Date(posted) > new Date(start)) {
    warnings.push('postedDate is after startDate');
  }
  if (start && deadline && new Date(start) > new Date(deadline)) {
    warnings.push('startDate is after deadline');
  }

  // Remote status vs location
  const remote = fields.remoteStatus?.value as string | undefined;
  const location = fields.location?.value as string | undefined;
  if (remote === 'remote' && location && !location.toLowerCase().includes('remote')) {
    warnings.push('Remote status is "remote" but location does not mention remote');
  }

  return warnings;
}

/**
 * Helper: Validate ISO date format
 */
function isValidISODate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Helper: Validate URI format
 */
function isValidURI(uri: string): boolean {
  try {
    new URL(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper: Validate email format
 */
function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Apply validation results to ExtractionResult
 */
export function applyValidationToResult(
  result: ExtractionResult,
  validation: ValidationReport
): ExtractionResult {
  const newWarnings: ExtractionWarning[] = [...result.warnings];
  const newErrors: ExtractionError[] = [...result.errors];

  // Add field validation warnings
  for (const fieldResult of validation.fieldResults) {
    for (const warning of fieldResult.warnings) {
      newWarnings.push({
        code: 'VALIDATION_WARNING',
        message: warning,
        field: fieldResult.field,
        severity: 'low',
        extractor: 'validator'
      });
    }
    for (const error of fieldResult.errors) {
      newErrors.push({
        code: 'VALIDATION_ERROR',
        message: error,
        field: fieldResult.field,
        recoverable: true,
        extractor: 'validator'
      });
    }
  }

  // Add cross-field warnings
  for (const warning of validation.warnings) {
    if (!validation.fieldResults.some(fr => fr.warnings.includes(warning))) {
      newWarnings.push({
        code: 'CROSS_FIELD_WARNING',
        message: warning,
        severity: 'low',
        extractor: 'validator'
      });
    }
  }

  return {
    ...result,
    warnings: newWarnings,
    errors: newErrors,
    provenance: {
      ...result.provenance,
      validationResults: validation.fieldResults
    }
  };
}

/**
 * Quick schema validation using JSON Schema
 */
export function validateAgainstJSONSchema(data: unknown): { valid: boolean; errors: string[] } {
  // Basic structural validation
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Root must be an object'] };
  }

  const obj = data as Record<string, unknown>;
  
  if (!obj.fields || typeof obj.fields !== 'object') {
    return { valid: false, errors: ['Missing or invalid "fields" object'] };
  }

  if (!Array.isArray(obj.warnings)) {
    return { valid: false, errors: ['Missing or invalid "warnings" array'] };
  }

  // Validate each field has value and confidence
  for (const [fieldName, fieldData] of Object.entries(obj.fields)) {
    const field = fieldData as Record<string, unknown>;
    if (!field || typeof field !== 'object') {
      return { valid: false, errors: [`Field "${fieldName}" must be an object`] };
    }
    if (!('value' in field)) {
      return { valid: false, errors: [`Field "${fieldName}" missing "value"`] };
    }
    if (!('confidence' in field) || typeof field.confidence !== 'number') {
      return { valid: false, errors: [`Field "${fieldName}" missing or invalid "confidence"`] };
    }
    if (field.confidence < 0 || field.confidence > 1) {
      return { valid: false, errors: [`Field "${fieldName}" confidence must be 0-1`] };
    }
  }

  return { valid: true, errors: [] };
}