import { BaseEntity, EntityId } from '../types';
import { RequirementType, EligibilityState } from '../enums';

export interface EligibilityRequirement extends BaseEntity {
  name: string;
  requirementType: RequirementType;
  value?: string;
  details?: Record<string, unknown>;
  isRequired: boolean;
  sourceEvidence?: string;
}

export interface OpportunityEligibility {
  id: string;
  opportunityId: EntityId;
  requirementId: EntityId;
  eligibilityState: EligibilityState;
  notes?: string;
}
