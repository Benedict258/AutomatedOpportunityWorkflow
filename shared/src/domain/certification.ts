import { BaseEntity, EntityId } from '../types';

export interface Certification extends BaseEntity {
  provider?: string;
  title: string;
  description?: string;
  url?: string;
  category?: string;
  costInfo?: string;
  deadline?: string;
  duration?: string;
  eligibility?: string;
  status?: string;
  sourceId?: EntityId;
}
