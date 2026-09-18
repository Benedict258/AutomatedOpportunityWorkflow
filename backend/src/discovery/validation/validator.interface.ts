import { ValidationContext, ValidationResult } from './types';

export interface Validator {
  validate(opportunity: unknown, context: ValidationContext): Promise<ValidationResult> | ValidationResult;
}
