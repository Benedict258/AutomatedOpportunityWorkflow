import { BaseEntity, EntityId } from '../types';

export interface ApplicationReference extends BaseEntity {
  opportunityId: EntityId;
  userId: EntityId;
  externalId?: string;
  applicationUrl?: string;
  status?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}
