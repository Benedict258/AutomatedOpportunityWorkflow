import { BaseEntity, EntityId } from '../types';
import { DuplicateState } from '../enums';

export interface DuplicateGroup extends BaseEntity {
  fingerprint?: string;
  canonicalOpportunityId?: EntityId;
  duplicateState: DuplicateState;
  metadata?: Record<string, unknown>;
}

export interface DuplicateMember {
  groupId: EntityId;
  opportunityId: EntityId;
  duplicateState: DuplicateState;
}
