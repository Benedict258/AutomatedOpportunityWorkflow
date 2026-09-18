import { BaseEntity } from '../types';

export interface SystemConfiguration extends BaseEntity {
  key: string;
  value: unknown;
  description?: string;
  metadata?: Record<string, unknown>;
}
