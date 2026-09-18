import { BaseEntity, EntityId } from '../types';

export interface Fellowship extends BaseEntity {
  name: string;
  organization?: string;
  description?: string;
  url?: string;
  fellowshipType?: string;
  location?: string;
  remoteInfo?: Record<string, unknown>;
  deadline?: string;
  eligibility?: string;
  duration?: string;
  stipendInfo?: string;
  sourceId?: EntityId;
  status?: string;
}
