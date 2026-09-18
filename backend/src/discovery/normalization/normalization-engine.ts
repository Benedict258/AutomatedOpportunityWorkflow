import { Normalizer } from './normalizer.interface';
import { NormalizedOpportunity, NormalizationContext, NormalizationResult, NormalizationWarning, NormalizationError, RemoteStatus, OpportunityType } from './types';
import { getMapper, FieldMapping } from './field-mappers';
import { DeadlineType } from '../../../../../shared/src/enums';

export class NormalizationEngine implements Normalizer {
  private supportedSources: Set<string>;

  constructor() {
    this.supportedSources = new Set();
  }

  supports(sourceId: string): boolean {
    return !!getMapper(sourceId);
  }

  getSupportedSources(): string[] {
    return Array.from(this.supportedSources).filter(Boolean);
  }

  async normalize(
    extractedFields: Record<string, unknown>,
    context: NormalizationContext
  ): Promise<NormalizationResult> {
    const start = Date.now();
    const warnings: NormalizationWarning[] = [];
    const errors: NormalizationError[] = [];

    const sourceId = context.sourceId.toLowerCase();
    const mapper = getMapper(sourceId);

    if (!mapper) {
      errors.push({
        code: 'UNSUPPORTED_SOURCE',
        message: `No field mapper found for source ${sourceId}`,
        field: 'sourceId',
        recoverable: false,
      });
      return {
        normalizedOpportunity: this.createEmptyOpportunity(sourceId, context),
        warnings,
        errors,
        metrics: {
          normalizedAt: new Date().toISOString(),
          processingMs: Date.now() - start,
        },
      };
    }

    // Map fields
    const mapped = this.mapFields(extractedFields, mapper.mappings);
    const opportunity = this.buildNormalizedOpportunity(mapped, mapper, context, warnings, errors);

    return {
      normalizedOpportunity: opportunity,
      warnings,
      errors,
      metrics: {
        normalizedAt: new Date().toISOString(),
        processingMs: Date.now() - start,
        sourceSchemaVersion: mapper.schemaVersion,
      },
    };
  }

  private mapFields(extractedFields: Record<string, unknown>, mappings: FieldMapping[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const mapping of mappings) {
      const rawValue = this.extractValue(extractedFields, mapping.sourceField);
      if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
        const transformed = mapping.transform ? mapping.transform(rawValue) : rawValue;
        this.assignNestedField(result, mapping.canonicalField, transformed);
      }
    }

    return result;
  }

  private extractValue(fields: Record<string, unknown>, path: string): unknown {
    // Support dot notation for nested fields
    const parts = path.split('.');
    let current: unknown = fields;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  private assignNestedField(target: Record<string, unknown>, fieldPath: string, value: unknown): void {
    const parts = fieldPath.split('.');
    let current = target;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    const last = parts[parts.length - 1];
    // If field already exists and is array, concat
    if (last in current && Array.isArray(current[last]) && Array.isArray(value)) {
      current[last] = [...current[last] as unknown[], ...value];
    } else {
      current[last] = value;
    }
  }

  private buildNormalizedOpportunity(
    mapped: Record<string, unknown>,
    mapper: any,
    context: NormalizationContext,
    warnings: NormalizationWarning[],
    errors: NormalizationError[]
  ): NormalizedOpportunity {
    const now = new Date().toISOString();

    const opportunity: NormalizedOpportunity = {
      source: context.sourceId,
      externalId: mapped.externalId ?? context.externalId?.toString(),
      title: this.requireString(mapped.title, 'title', warnings, errors, 'Title is required'),
      organization: this.coerceString(mapped.organization),
      description: this.coerceString(mapped.description),
      url: this.coerceString(mapped.url),
      location: this.coerceString(mapped.location),
      remoteStatus: this.normalizeRemoteStatus(mapped.remoteStatus),
      remoteInfo: mapped.remoteInfo ?? undefined,
      opportunityType: this.normalizeOpportunityType(mapped.opportunityType),
      category: this.normalizeCategory(mapped.category),
      skills: this.normalizeSkills(mapped.skills),
      eligibility: this.normalizeEligibility(mapped.eligibility),
      educationRequirements: this.normalizeStringArray(mapped.educationRequirements),
      experienceRequirements: this.normalizeStringArray(mapped.experienceRequirements),
      compensation: this.normalizeCompensation(mapped.compensation, mapped.salary_min, mapped.salary_max, mapped.salary_currency),
      applicationMethod: this.normalizeStringArray(mapped.applicationMethod),
      applicationUrl: this.coerceString(mapped.applicationUrl),
      publicationDate: this.normalizeDate(mapped.publicationDate),
      deadline: this.normalizeDate(mapped.deadline),
      deadlineType: this.normalizeDeadlineType(mapped.deadlineType),
      status: 'DISCOVERED',
      firstSeenAt: now,
      lastSeenAt: now,
      provenance: {
        normalizedAt: now,
        confidence: context.extractionResult?.confidence,
        warnings: warnings.map(w => w.message),
      },
    };

    // Apply defaults
    if (mapper.defaultValues) {
      for (const [key, value] of Object.entries(mapper.defaultValues)) {
        if (!(key in opportunity) || opportunity[key as keyof NormalizedOpportunity] === undefined) {
          (opportunity as any)[key] = value;
        }
      }
    }

    // Ensure required fields
    if (!opportunity.title) {
      errors.push({
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Title could not be normalized',
        field: 'title',
        recoverable: false,
      });
    }

    return opportunity;
  }

  private createEmptyOpportunity(sourceId: string, context: NormalizationContext): NormalizedOpportunity {
    return {
      source: sourceId,
      externalId: context.externalId?.toString(),
      title: '',
      remoteStatus: 'UNKNOWN',
      opportunityType: 'UNKNOWN',
      deadlineType: DeadlineType.UNKNOWN,
      status: 'DISCOVERED',
      firstSeenAt: new Date().toISOString(),
    };
  }

  private requireString(value: unknown, field: string, warnings: NormalizationWarning[], errors: NormalizationError[], message?: string): string {
    const str = this.coerceString(value);
    if (!str) {
      errors.push({
        code: 'MISSING_REQUIRED_FIELD',
        message: message || `${field} is required`,
        field,
        recoverable: false,
      });
    }
    return str || '';
  }

  private coerceString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') return value.trim() || undefined;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.join(', ');
    return undefined;
  }

  private normalizeRemoteStatus(value: unknown): RemoteStatus {
    if (!value) return 'UNKNOWN';
    const v = String(value).toLowerCase();
    if (['remote', 'fully remote', 'work from home'].includes(v)) return 'REMOTE';
    if (['hybrid', 'partially remote'].includes(v)) return 'HYBRID';
    if (['onsite', 'in office', 'on-site'].includes(v)) return 'ONSITE';
    if (['flexible'].includes(v)) return 'FLEXIBLE';
    return 'UNKNOWN';
  }

  private normalizeOpportunityType(value: unknown): OpportunityType {
    if (!value) return 'UNKNOWN';
    const v = String(value).toLowerCase();
    if (v.includes('intern')) return 'INTERNSHIP';
    if (v.includes('fellow')) return 'FELLOWSHIP';
    if (v.includes('certif')) return 'CERTIFICATION';
    if (v.includes('event') || v.includes('conference')) return 'EVENT';
    if (v.includes('contract')) return 'CONTRACT';
    if (v.includes('volunteer')) return 'VOLUNTEER';
    if (v.includes('job') || v.includes('position')) return 'JOB';
    return 'UNKNOWN';
  }

  private normalizeCategory(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(v => String(v)).filter(Boolean);
    return [String(value)];
  }

  private normalizeSkills(value: unknown): any[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map(v => typeof v === 'string' ? { name: v } : v);
    }
    if (typeof value === 'string') {
      return value.split(',').map(s => ({ name: s.trim() }));
    }
    return [];
  }

  private normalizeEligibility(value: unknown): any[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [{ type: 'general', value }];
    return [];
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(v => String(v)).filter(Boolean);
    if (typeof value === 'string') return value.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
    return [];
  }

  private normalizeCompensation(compensation: unknown, min?: unknown, max?: unknown, currency?: unknown): any | undefined {
    // Simplified compensation normalization
    if (compensation && typeof compensation === 'object') {
      return compensation as any;
    }
    const minNum = Number(min);
    const maxNum = Number(max);
    if (!isNaN(minNum) || !isNaN(maxNum)) {
      return {
        min: isNaN(minNum) ? undefined : minNum,
        max: isNaN(maxNum) ? undefined : maxNum,
        currency: currency ? String(currency) : undefined,
        period: 'UNKNOWN',
      };
    }
    return undefined;
  }

  private normalizeDate(value: unknown): string | undefined {
    if (!value) return undefined;
    try {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) return undefined;
      return d.toISOString();
    } catch {
      return undefined;
    }
  }

  private normalizeDeadlineType(value: unknown): DeadlineType {
    if (!value) return DeadlineType.UNKNOWN;
    const v = String(value).toLowerCase();
    if (v === 'fixed' || v === 'hard') return DeadlineType.FIXED;
    if (v === 'rolling' || v === 'open') return DeadlineType.ROLLING;
    return DeadlineType.UNKNOWN;
  }
}
