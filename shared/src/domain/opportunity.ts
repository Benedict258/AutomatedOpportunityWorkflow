import { BaseEntity, EntityId } from '../types';
import { OpportunityStatus, DeadlineType } from '../enums';

export interface Opportunity extends BaseEntity {
  stableId: EntityId;
  sourceId: EntityId;
  externalId?: string;
  title: string;
  organization?: string;
  description?: string;
  url?: string;
  location?: string;
  remoteInfo?: Record<string, unknown>;
  opportunityType?: string;
  categoryIds?: EntityId[];
  status: OpportunityStatus;
  publicationDate?: string;
  applicationDeadline?: string | null;
  deadlineType: DeadlineType;
  firstSeenAt: string;
  lastSeenAt?: string;
  lastVerifiedAt?: string;
  closedAt?: string;
  lifecycleStage?: string;
}

export interface OpportunityCategory {
  id: EntityId;
  name: string;
  parentId?: EntityId;
  metadata?: Record<string, unknown>;
}
