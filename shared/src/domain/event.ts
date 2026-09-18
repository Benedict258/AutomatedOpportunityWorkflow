import { BaseEntity, EntityId } from '../types';

export interface Event extends BaseEntity {
  name: string;
  organizer?: string;
  description?: string;
  url?: string;
  eventType?: string;
  location?: string;
  remoteInfo?: Record<string, unknown>;
  startDate?: string;
  endDate?: string;
  registrationDeadline?: string;
  sourceId?: EntityId;
  status?: string;
}
