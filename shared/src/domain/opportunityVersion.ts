import { EntityId } from '../types';

export interface OpportunityVersion {
  id: EntityId;
  opportunityId: EntityId;
  versionNumber: number;
  capturedAt: string;
  title?: string;
  description?: string;
  applicationDeadline?: string | null;
  deadlineType?: string;
  location?: string;
  url?: string;
  status?: string;
  changeMetadata?: Record<string, unknown>;
}
