import { NormalizedOpportunity } from '../normalization/types';

export type FreshnessStatus = 'FRESH' | 'STALE' | 'EXPIRED' | 'UNKNOWN';

export type ChangeType = 'NONE' | 'TITLE' | 'DESCRIPTION' | 'DEADLINE' | 'STATUS' | 'COMPENSATION' | 'LOCATION' | 'MULTIPLE';

export interface FreshnessCheck {
  opportunityId: string;
  source: string;
  externalId?: string;
  stableId?: string;
  lastSeenAt?: string;
  firstSeenAt?: string;
  lastVerifiedAt?: string;
  freshnessStatus: FreshnessStatus;
  staleSince?: string;
  nextCheckDueAt?: string;
  changeType?: ChangeType;
  changeSummary?: string[];
  metrics?: FreshnessMetrics;
}

export interface VerificationResult {
  opportunityId: string;
  source: string;
  externalId?: string;
  verifiedAt: string;
  isActive: boolean;
  isExpired: boolean;
  deadlinePassed: boolean;
  sourceReachable: boolean;
  sourceCheckError?: string;
  deadline?: string | null;
  currentStatus?: string;
  confidence: number; // 0-1
  notes?: string[];
}

export interface FreshnessMetrics {
  ageHours: number;
  daysSinceLastSeen: number;
  checksPerformed: number;
  changesDetected: number;
  verificationFailures: number;
  lastChangeAt?: string;
}

export interface ChangeDetectionResult {
  hasChanged: boolean;
  changeType: ChangeType;
  changedFields: string[];
  previousVersion?: NormalizedOpportunity;
  currentVersion: NormalizedOpportunity;
  diffSummary: string;
}

export interface FreshnessEngineOptions {
  staleThresholdHours?: number;
  expiryThresholdHours?: number;
  checkIntervalHours?: number;
  maxAgeDays?: number;
}
