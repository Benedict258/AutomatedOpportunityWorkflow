import { BaseEntity } from '../types';

export interface Source extends BaseEntity {
  name: string;
  url?: string;
  sourceType?: string;
  metadata?: Record<string, unknown>;
}
