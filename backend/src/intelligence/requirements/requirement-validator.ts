/**
 * Requirement Extraction Output Validator
 * 
 * Validates model requirement extraction output against schema and business rules.
 * Ensures all requirements have valid relationship classification: REQUIRED/PREFERRED/OPTIONAL/INFERRED/UNKNOWN
 */

import type { Requirement, RequirementType, RequirementRelationship, RequirementConfidence, RequirementExtractionResult } from './types';
import { REQUIREMENT_EXTRACTION_JSON_SCHEMA } from './prompt-v1';

/**
 * Validation result for a single requirement
 */
export interface RequirementValidationResult {
  valid: boolean;
  requirementIndex: number;
  errors: string[];
  warnings: string[];
  requirement: Partial<Requirement>;
}

/**
 * Aggregated validation report
 */
export interface RequirementValidationReport {
  valid: boolean;
  results: RequirementValidationResult[];
  errors: string[];
  warnings: string[];
  summary: {
    totalRequirements: number;
    validRequirements: number;
    invalidRequirements: number;
    byRelationship: Record<RequirementRelationship, number>;
    byType: Record<RequirementType, number>;
    inferredCount: number;
    explicitCount: number;
  };
}

/**
 * Valid relationship types - used to verify no invalid relationships slip through
 */
const VALID_RELATIONSHIPS: RequirementRelationship[] = [
  'REQUIRED',
  'PREFERRED', 
  'OPTIONAL', 
  'INFERRED', 
  'UNKNOWN'
];

/**
 * Valid requirement types
 */
const VALID_TYPES: RequirementType[] = [
  'SKILL',
  'TECHNOLOGY', 
  'CERTIFICATION',
  'EDUCATION',
  'EXPERIENCE',
  'LOCATION',
  'CITIZENSHIP',
  'WORK_AUTHORIZATION',
  'CLEARANCE',
  'LANGUAGE'
];

/**
 * Confidence thresholds per relationship type
 */
const RELATIONSHIP_CONFIDENCE_MIN: Record<RequirementRelationship, number> = {
  REQUIRED: 0.7,
  PREFERRED: 0.6,
  OPTIONAL: 0.5,
  INFERRED: 0.3,
  UNKNOWN: 0.1
};

/**
 * Validate requirement extraction output
 */
export function validateRequirementExtraction(
  requirements: Requirement[],
  options: { strictMode?: boolean; requireEvidence?: boolean } = {}
): RequirementValidationReport {
  const { strictMode = false, requireEvidence = true } = options;
  
  const results: RequirementValidationResult[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const byRelationship: Record<RequirementRelationship, number> = {} as Record<RequirementRelationship, number>;
  const byType: Record<RequirementType, number> = {} as Record<RequirementType, number>;
  
  // Initialize counters
  for (const rel of VALID_RELATIONSHIPS) byRelationship[rel] = 0;
  for (const type of VALID_TYPES) byType[type] = 0;
  
  let inferredCount = 0;
  let explicitCount = 0;
  
  for (let i = 0; i < requirements.length; i++) {
    const req = requirements[i];
    const reqErrors: string[] = [];
    const reqWarnings: string[] = [];
    
    // 1. Validate required fields exist
    if (!req.id) reqErrors.push('Missing required field: id');
    if (!req.type) reqErrors.push('Missing required field: type');
    if (!req.value) reqErrors.push('Missing required field: value');
    if (!req.relationship) reqErrors.push('Missing required field: relationship');
    if (req.confidence === undefined || req.confidence === null) reqErrors.push('Missing required field: confidence');
    if (!req.provenance || req.provenance.length === 0) reqErrors.push('Missing required field: provenance');
    if (!req.extractedAt) reqErrors.push('Missing required field: extractedAt');
    
    // 2. Validate type
    if (req.type && !VALID_TYPES.includes(req.type)) {
      reqErrors.push(`Invalid requirement type: ${req.type}. Must be one of: ${VALID_TYPES.join(', ')}`);
    }
    
    // 3. Validate relationship - CRITICAL: Must be one of the 5 valid types
    if (req.relationship && !VALID_RELATIONSHIPS.includes(req.relationship)) {
      reqErrors.push(`Invalid relationship: ${req.relationship}. Must be one of: ${VALID_RELATIONSHIPS.join(', ')}`);
    }
    
    // 4. Validate confidence range
    if (typeof req.confidence === 'number') {
      if (req.confidence < 0 || req.confidence > 1) {
        reqErrors.push(`Confidence must be between 0 and 1, got: ${req.confidence}`);
      }
      
      // Check confidence against relationship minimums
      if (req.relationship && RELATIONSHIP_CONFIDENCE_MIN[req.relationship] !== undefined) {
        const minConf = RELATIONSHIP_CONFIDENCE_MIN[req.relationship];
        if (req.confidence < minConf) {
          reqWarnings.push(`Low confidence (${req.confidence}) for ${req.relationship} relationship (minimum recommended: ${minConf})`);
        }
      }
    }
    
    // 5. Validate provenance
    if (req.provenance) {
      for (let p = 0; p < req.provenance.length; p++) {
        const prov = req.provenance[p];
        if (!prov.source) reqErrors.push(`Provenance ${p}: missing source`);
        if (!prov.snippet) reqWarnings.push(`Provenance ${p}: missing evidence snippet`);
      }
    }
    
    // 6. Require evidence for non-INFERRED/UNKNOWN relationships
    if (requireEvidence && req.relationship && !['INFERRED', 'UNKNOWN'].includes(req.relationship)) {
      const hasEvidence = req.provenance?.some(p => p.snippet && p.snippet.trim().length > 0);
      if (!hasEvidence) {
        reqErrors.push(`Missing evidence snippet for explicit requirement (${req.relationship})`);
      }
    }
    
    // 7. Validate normalizedValue exists
    if (!req.normalizedValue) {
      reqWarnings.push('Missing normalizedValue - will be auto-generated');
    }
    
    // 8. Validate evidence snippet is not too generic
    if (req.provenance?.[0]?.snippet) {
      const snippet = req.provenance[0].snippet;
      if (snippet.length < 10) {
        reqWarnings.push('Evidence snippet very short - may be incomplete');
      }
      // Check for generic snippets
      if (/^requirements?:?$/i.test(snippet.trim()) || /^qualifications?:?$/i.test(snippet.trim())) {
        reqWarnings.push('Evidence snippet appears to be a section header only');
      }
    }
    
    // 9. CRITICAL: Never treat INFERRED as explicit
    if (req.relationship === 'INFERRED') {
      inferredCount++;
      // Verify it's not being treated as explicit
      if (req.confidence > 0.8) {
        reqWarnings.push('High confidence on INFERRED requirement - verify this is not explicit');
      }
    } else if (req.relationship !== 'UNKNOWN') {
      explicitCount++;
    }
    
    // Count by relationship and type
    if (req.relationship && VALID_RELATIONSHIPS.includes(req.relationship)) {
      byRelationship[req.relationship]++;
    }
    if (req.type && VALID_TYPES.includes(req.type)) {
      byType[req.type]++;
    }
    
    const valid = reqErrors.length === 0;
    results.push({
      valid,
      requirementIndex: i,
      errors: reqErrors,
      warnings: reqWarnings,
      requirement: req
    });
    
    if (!valid) {
      errors.push(...reqErrors.map(e => `Requirement[${i}]: ${e}`));
    }
    warnings.push(...reqWarnings.map(w => `Requirement[${i}]: ${w}`));
  }
  
  // Cross-requirement validation
  const crossWarnings = validateCrossRequirements(requirements);
  warnings.push(...crossWarnings);
  
  const validCount = results.filter(r => r.valid).length;
  
  return {
    valid: errors.length === 0,
    results,
    errors,
    warnings,
    summary: {
      totalRequirements: requirements.length,
      validRequirements: validCount,
      invalidRequirements: requirements.length - validCount,
      byRelationship,
      byType,
      inferredCount,
      explicitCount
    }
  };
}

/**
 * Cross-requirement validation rules
 */
function validateCrossRequirements(requirements: Requirement[]): string[] {
  const warnings: string[] = [];
  
  // Check for duplicate requirements (same type + normalized value)
  const seen = new Map<string, number>();
  for (let i = 0; i < requirements.length; i++) {
    const req = requirements[i];
    if (req.normalizedValue) {
      const key = `${req.type}:${req.normalizedValue}`;
      if (seen.has(key)) {
        warnings.push(`Duplicate requirement detected: ${key} (first at index ${seen.get(key)}, also at ${i})`);
      } else {
        seen.set(key, i);
      }
    }
  }
  
  // Check for conflicting relationships on same requirement
  const byNormValue = new Map<string, RequirementRelationship[]>();
  for (const req of requirements) {
    if (req.normalizedValue) {
      const key = `${req.type}:${req.normalizedValue}`;
      if (!byNormValue.has(key)) byNormValue.set(key, []);
      byNormValue.get(key)!.push(req.relationship);
    }
  }
  for (const [key, relationships] of byNormValue) {
    if (relationships.length > 1) {
      const unique = new Set(relationships);
      if (unique.size > 1) {
        warnings.push(`Conflicting relationships for ${key}: ${Array.from(unique).join(', ')}`);
      }
    }
  }
  
  // Check if REQUIRED count is reasonable (not everything is REQUIRED)
  const requiredCount = requirements.filter(r => r.relationship === 'REQUIRED').length;
  const totalCount = requirements.length;
  if (totalCount > 5 && requiredCount / totalCount > 0.9) {
    warnings.push(`Unusually high REQUIRED ratio (${requiredCount}/${totalCount}) - verify classification`);
  }
  
  // Check for missing common requirement types based on context
  const hasSkill = requirements.some(r => r.type === 'SKILL');
  const hasExperience = requirements.some(r => r.type === 'EXPERIENCE');
  const hasEducation = requirements.some(r => r.type === 'EDUCATION');
  if (!hasSkill && !hasExperience && !hasEducation) {
    warnings.push('No skill, experience, or education requirements found - verify extraction completeness');
  }
  
  return warnings;
}

/**
 * Apply validation results to RequirementExtractionResult
 */
export function applyRequirementValidationToResult(
  result: RequirementExtractionResult,
  validation: RequirementValidationReport
): RequirementExtractionResult {
  const newWarnings = [...result.warnings];
  const newErrors = [...result.errors];
  
  // Add field validation warnings
  for (const reqResult of validation.results) {
    for (const warning of reqResult.warnings) {
      newWarnings.push({
        code: 'REQUIREMENT_VALIDATION_WARNING',
        message: warning,
        field: `requirements[${reqResult.requirementIndex}]`,
        severity: 'low'
      });
    }
    for (const error of reqResult.errors) {
      newErrors.push({
        code: 'REQUIREMENT_VALIDATION_ERROR',
        message: error,
        field: `requirements[${reqResult.requirementIndex}]`,
        recoverable: true
      });
    }
  }
  
  // Add cross-field warnings
  for (const warning of validation.warnings) {
    newWarnings.push({
      code: 'REQUIREMENT_CROSS_VALIDATION_WARNING',
      message: warning,
      severity: 'low'
    });
  }
  
  return {
    ...result,
    warnings: newWarnings,
    errors: newErrors,
    requirements: result.requirements.map((req, i) => ({
      ...req,
      // Add validation metadata
      metadata: {
        ...req.metadata,
        validation: {
          valid: validation.results[i]?.valid ?? true,
          errors: validation.results[i]?.errors ?? [],
          warnings: validation.results[i]?.warnings ?? []
        }
      }
    }))
  };
}

/**
 * Quick structural validation using JSON Schema
 */
export function validateRequirementOutputAgainstSchema(data: unknown): { valid: boolean; errors: string[] } {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Root must be an object'] };
  }
  
  const obj = data as Record<string, unknown>;
  
  if (!Array.isArray(obj.requirements)) {
    return { valid: false, errors: ['Missing or invalid "requirements" array'] };
  }
  
  if (!Array.isArray(obj.warnings)) {
    return { valid: false, errors: ['Missing or invalid "warnings" array'] };
  }
  
  // Validate each requirement
  for (let i = 0; i < obj.requirements.length; i++) {
    const req = obj.requirements[i] as Record<string, unknown>;
    
    if (!req || typeof req !== 'object') {
      return { valid: false, errors: [`Requirement[${i}] must be an object`] };
    }
    
    // Required fields
    const requiredFields = ['type', 'value', 'relationship', 'confidence', 'evidence', 'normalizedValue'];
    for (const field of requiredFields) {
      if (!(field in req)) {
        return { valid: false, errors: [`Requirement[${i}] missing required field: ${field}`] };
      }
    }
    
    // Validate type
    if (!VALID_TYPES.includes(req.type as RequirementType)) {
      return { valid: false, errors: [`Requirement[${i}] invalid type: ${req.type}`] };
    }
    
    // Validate relationship - CRITICAL CHECK
    if (!VALID_RELATIONSHIPS.includes(req.relationship as RequirementRelationship)) {
      return { valid: false, errors: [`Requirement[${i}] invalid relationship: ${req.relationship}. Must be one of: ${VALID_RELATIONSHIPS.join(', ')}`] };
    }
    
    // Validate confidence
    const conf = req.confidence;
    if (typeof conf !== 'number' || conf < 0 || conf > 1) {
      return { valid: false, errors: [`Requirement[${i}] confidence must be a number between 0 and 1`] };
    }
    
    // Validate evidence
    if (typeof req.evidence !== 'string' || req.evidence.trim().length === 0) {
      return { valid: false, errors: [`Requirement[${i}] evidence must be a non-empty string`] };
    }
  }
  
  return { valid: true, errors: [] };
}

/**
 * Check if a requirement relationship is explicit (not inferred/unknown)
 */
export function isExplicitRelationship(relationship: RequirementRelationship): boolean {
  return ['REQUIRED', 'PREFERRED', 'OPTIONAL'].includes(relationship);
}

/**
 * Check if a requirement relationship is inferred
 */
export function isInferredRelationship(relationship: RequirementRelationship): boolean {
  return relationship === 'INFERRED';
}

/**
 * Get relationship strength for sorting/merging (higher = stronger)
 */
export function getRelationshipStrength(relationship: RequirementRelationship): number {
  switch (relationship) {
    case 'REQUIRED': return 4;
    case 'PREFERRED': return 3;
    case 'OPTIONAL': return 2;
    case 'INFERRED': return 1;
    case 'UNKNOWN': return 0;
  }
}

/**
 * Merge requirements with same normalized value, keeping strongest relationship
 */
export function mergeDuplicateRequirements(requirements: Requirement[]): Requirement[] {
  const merged = new Map<string, Requirement>();
  
  for (const req of requirements) {
    const key = `${req.type}:${req.normalizedValue}`;
    const existing = merged.get(key);
    
    if (!existing) {
      merged.set(key, req);
    } else {
      // Keep stronger relationship
      if (getRelationshipStrength(req.relationship) > getRelationshipStrength(existing.relationship)) {
        // Merge provenance
        const combined = {
          ...req,
          provenance: [...existing.provenance, ...req.provenance]
        };
        merged.set(key, combined);
      } else {
        // Merge provenance into existing
        existing.provenance.push(...req.provenance);
      }
    }
  }
  
  return Array.from(merged.values());
}