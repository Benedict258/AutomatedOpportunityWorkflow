import { BaseEntity, EntityId } from '../types';

export interface NewsItem extends BaseEntity {
  title: string;
  sourceId: EntityId;
  url?: string;
  summary?: string;
  publishedAt?: string;
  discoveredAt?: string;
  topic?: string;
  organization?: string;
  sector?: string;
  geography?: string;
  relevance?: number;
  relatedOpportunityIds?: EntityId[];
}
