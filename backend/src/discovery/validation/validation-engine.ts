import { ValidationContext, ValidationResult, ValidationIssue, ValidationSeverity, ValidationRule } from './types';
import { Validator } from './validator.interface';
import { defaultValidationRules } from './rule-engine';

export class ValidationEngine implements Validator {
  private rules: ValidationRule[];

  constructor(rules?: ValidationRule[]) {
    this.rules = rules ?? defaultValidationRules;
  }

  public validate(opportunity: unknown, context: ValidationContext): ValidationResult {
    const start = Date.now();
    const opp = opportunity as any;
    const opportunityId = opp?.externalId ?? opp?.stableId ?? 'unknown';
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const infos: ValidationIssue[] = [];
    const remediationSet = new Set<string>();

    let rulesExecuted = 0;

    for (const rule of this.rules) {
      rulesExecuted++;
      try {
        const issue = rule.check({ ...context, opportunity: opp });
        if (issue) {
          switch (issue.severity) {
            case 'ERROR':
              errors.push(issue);
              break;
            case 'WARNING':
              warnings.push(issue);
              break;
            case 'INFO':
              infos.push(issue);
              break;
            default:
              warnings.push(issue);
          }
          if (issue.remediation) {
            remediationSet.add(issue.remediation);
          }
        } else {
          // Rule passed, optionally track pass
        }
      } catch (e) {
        const errIssue: ValidationIssue = {
          code: 'RULE_EXECUTION_ERROR',
          message: `Rule '${rule.id}' threw error: ${(e as Error).message}`,
          severity: 'ERROR',
          remediation: 'Fix rule implementation or provide valid opportunity data',
        };
        errors.push(errIssue);
      }
    }

    const valid = errors.length === 0;
    const passed = valid && warnings.length === 0;

    const totalIssues = errors.length + warnings.length + infos.length;
    const score = rulesExecuted > 0 ? Math.max(0, 100 - Math.round((totalIssues / rulesExecuted) * 100)) : 100;

    const result: ValidationResult = {
      opportunityId,
      sourceId: context.sourceId,
      valid,
      passed,
      score,
      errors,
      warnings,
      infos,
      remediationSuggestions: Array.from(remediationSet),
      checkedAt: new Date().toISOString(),
      rulesExecuted,
    };

    return result;
  }

  public async validateBatch(
    opportunities: Array<{ opportunity: unknown; context: ValidationContext }>
  ): Promise<ValidationResult[]> {
    return opportunities.map(({ opportunity, context }) => this.validate(opportunity, context));
  }

  public getRules(): ValidationRule[] {
    return this.rules;
  }

  public withRules(rules: ValidationRule[]): ValidationEngine {
    return new ValidationEngine(rules);
  }
}
