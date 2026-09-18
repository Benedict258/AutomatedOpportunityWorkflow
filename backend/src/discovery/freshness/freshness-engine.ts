import {
  FreshnessCheck,
  FreshnessStatus,
  FreshnessMetrics,
  FreshnessEngineOptions,
  ChangeDetectionResult,
} from './types';
import { NormalizedOpportunity } from '../normalization/types';

export class FreshnessEngine {
  private staleThresholdHours: number;
  private expiryThresholdHours: number;
  private checkIntervalHours: number;
  private maxAgeDays: number;

  constructor(options: FreshnessEngineOptions = {}) {
    this.staleThresholdHours = options.staleThresholdHours ?? 72;
    this.expiryThresholdHours = options.expiryThresholdHours ?? 720;
    this.checkIntervalHours = options.checkIntervalHours ?? 24;
    this.maxAgeDays = options.maxAgeDays ?? 90;
  }

  /**
   * Track last seen timestamp for an opportunity
   */
  public trackLastSeen(
    stored: NormalizedOpportunity,
    nowIso: string = new Date().toISOString()
  ): NormalizedOpportunity {
    const firstSeenAt = stored.firstSeenAt ?? nowIso;
    const lastSeenAt = nowIso;
    return {
      ...stored,
      firstSeenAt,
      lastSeenAt,
      provenance: {
        ...stored.provenance,
        normalizedAt: nowIso,
      },
    };
  }

  /**
   * Determine freshness status based on last seen timestamp
   */
  public evaluateFreshness(check: FreshnessCheck, now: Date = new Date()): FreshnessCheck {
    const lastSeen = check.lastSeenAt ? new Date(check.lastSeenAt) : null;
    const ageHours = lastSeen ? (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60) : Infinity;

    let freshnessStatus: FreshnessStatus = 'UNKNOWN';
    let staleSince: string | undefined;

    if (!lastSeen) {
      freshnessStatus = 'UNKNOWN';
    } else if (ageHours > this.expiryThresholdHours) {
      freshnessStatus = 'EXPIRED';
    } else if (ageHours > this.staleThresholdHours) {
      freshnessStatus = 'STALE';
      staleSince = new Date(now.getTime() - this.staleThresholdHours * 60 * 60 * 1000).toISOString();
    } else {
      freshnessStatus = 'FRESH';
    }

    const nextCheckDueAt = new Date(now.getTime() + this.checkIntervalHours * 60 * 60 * 1000).toISOString();

    const metrics: FreshnessMetrics = {
      ageHours,
      daysSinceLastSeen: ageHours / 24,
      checksPerformed: 0,
      changesDetected: 0,
      verificationFailures: 0,
    };

    return {
      ...check,
      freshnessStatus,
      staleSince,
      nextCheckDueAt,
      metrics,
    };
  }

  /**
   * Detect staleness for a batch of opportunities
   */
  public detectStale(opportunities: NormalizedOpportunity[], nowIso?: string): FreshnessCheck[] {
    const now = nowIso ? new Date(nowIso) : new Date();
    return opportunities.map(opp => {
      const check: FreshnessCheck = {
        opportunityId: opp.stableId ?? opp.externalId ?? `${opp.source}-${opp.title}`,
        source: opp.source,
        externalId: opp.externalId,
        stableId: opp.stableId,
        lastSeenAt: opp.lastSeenAt,
        firstSeenAt: opp.firstSeenAt,
        freshnessStatus: 'UNKNOWN',
      };
      return this.evaluateFreshness(check, now);
    });
  }

  /**
   * Integrate change detection result into freshness check
   */
  public applyChangeDetection(
    check: FreshnessCheck,
    changeResult: ChangeDetectionResult
  ): FreshnessCheck {
    const nowIso = new Date().toISOString();
    return {
      ...check,
      lastVerifiedAt: nowIso,
      changeType: changeResult.hasChanged ? changeResult.changeType : 'NONE',
      changeSummary: changeResult.changedFields,
    };
  }

  /**
   * Compute freshness metrics from historical checks
   */
  public computeMetrics(checks: FreshnessCheck[]): FreshnessMetrics {
    if (checks.length === 0) {
      return {
        ageHours: 0,
        daysSinceLastSeen: 0,
        checksPerformed: 0,
        changesDetected: 0,
        verificationFailures: 0,
      };
    }

    const latest = checks[checks.length - 1];
    const ageHours = latest.metrics?.ageHours ?? 0;
    const changesDetected = checks.filter(c => c.changeType && c.changeType !== 'NONE').length;
    const verificationFailures = checks.filter(c => c.freshnessStatus === 'EXPIRED').length;

    return {
      ageHours,
      daysSinceLastSeen: ageHours / 24,
      checksPerformed: checks.length,
      changesDetected,
      verificationFailures,
      lastChangeAt: checks.find(c => c.changeType && c.changeType !== 'NONE')?.lastVerifiedAt,
    };
  }
}
