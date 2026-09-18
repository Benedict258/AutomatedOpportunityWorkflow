import { NormalizedOpportunity } from '../normalization/types';
import { ChangeDetectionResult, ChangeType } from './types';

export class ChangeDetector {
  /**
   * Compare normalized opportunity vs stored version for changes
   * Deterministic stub: field-by-field comparison with normalization
   */
  public compare(
    stored: NormalizedOpportunity,
    current: NormalizedOpportunity
  ): ChangeDetectionResult {
    const changedFields: string[] = [];
    const diffs: string[] = [];

    const fieldsToCompare: (keyof NormalizedOpportunity)[] = [
      'title',
      'description',
      'organization',
      'location',
      'deadline',
      'status',
      'opportunityType',
      'compensation',
      'url',
      'applicationUrl',
    ];

    for (const field of fieldsToCompare) {
      const storedVal = (stored as any)[field];
      const currentVal = (current as any)[field];
      if (!this.deepEqual(storedVal, currentVal)) {
        changedFields.push(field as string);
        diffs.push(`${field}: ${this.formatValue(storedVal)} -> ${this.formatValue(currentVal)}`);
      }
    }

    const hasChanged = changedFields.length > 0;
    const changeType = this.resolveChangeType(changedFields);
    const diffSummary = diffs.join('; ');

    return {
      hasChanged,
      changeType,
      changedFields,
      previousVersion: stored,
      currentVersion: current,
      diffSummary,
    };
  }

  private resolveChangeType(fields: string[]): ChangeType {
    if (fields.length === 0) return 'NONE';
    if (fields.length === 1) {
      switch (fields[0]) {
        case 'title': return 'TITLE';
        case 'description': return 'DESCRIPTION';
        case 'deadline': return 'DEADLINE';
        case 'status': return 'STATUS';
        case 'compensation': return 'COMPENSATION';
        case 'location': return 'LOCATION';
      }
    }
    return 'MULTIPLE';
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    if (typeof a === 'object') {
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch {
        return false;
      }
    }
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  private formatValue(val: unknown): string {
    if (val == null) return 'null';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  /**
   * Normalize opportunity for stable comparison (strip volatile fields)
   */
  public normalizeForComparison(opp: NormalizedOpportunity): NormalizedOpportunity {
    const { firstSeenAt, lastSeenAt, provenance, ...rest } = opp;
    return rest;
  }
}
