export enum LifecycleState {
  NEW = 'NEW',
  ACTIVE = 'ACTIVE',
  STALE = 'STALE',
  EXPIRED = 'EXPIRED',
  CLOSED = 'CLOSED',
}

export enum VersionEventType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  STATE_CHANGED = 'STATE_CHANGED',
  CLOSED = 'CLOSED',
}

export interface OpportunityVersion {
  id: string;
  opportunityId: string;
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

export interface VersionEvent {
  eventId: string;
  opportunityId: string;
  versionId?: string;
  eventType: VersionEventType;
  timestamp: string;
  previousState?: LifecycleState;
  newState?: LifecycleState;
  metadata?: Record<string, unknown>;
}

export interface OpportunityLifecycleMeta {
  opportunityId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  modifiedAt: string;
  state: LifecycleState;
  versionCount: number;
}

export interface VersioningResult {
  success: boolean;
  opportunityId: string;
  version?: OpportunityVersion;
  meta?: OpportunityLifecycleMeta;
  event?: VersionEvent;
  error?: string;
}

export interface CreateVersionInput {
  opportunityId: string;
  title?: string;
  description?: string;
  applicationDeadline?: string | null;
  deadlineType?: string;
  location?: string;
  url?: string;
  status?: string;
  previousSnapshot?: Partial<OpportunityVersion>;
}
