import { EligibilityDecision, EligibilityState } from '../types';

export function isMissing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
}

export function makeDecision(
  requirementId: string,
  requirement: string,
  candidateField: string,
  state: EligibilityState,
  reason: string,
  evidence?: unknown,
  confidence = 0.5
): EligibilityDecision {
  return {
    requirementId,
    requirement,
    candidateField,
    state,
    reason,
    evidence,
    confidence,
    missing: state === 'UNCERTAIN' && isMissing(evidence),
  };
}

export function compareDates(dateStr: string, operator: 'gte' | 'lte' | 'eq'): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  if (isNaN(d.getTime())) return false;
  if (operator === 'gte') return d >= now;
  if (operator === 'lte') return d <= now;
  return d.getTime() === now.getTime();
}
