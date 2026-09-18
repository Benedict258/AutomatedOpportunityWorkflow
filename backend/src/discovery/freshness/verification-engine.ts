import { NormalizedOpportunity } from '../normalization/types';
import { VerificationResult } from './types';

export interface VerificationSourceCheck {
  sourceReachable: boolean;
  sourceCheckError?: string;
  fetchedStatus?: string;
  fetchedDeadline?: string | null;
}

export class VerificationEngine {
  /**
   * Verify opportunity still active via source check and deadline verification
   * Stub with deterministic logic based on opportunity fields
   */
  public verify(
    opportunity: NormalizedOpportunity,
    sourceCheck?: VerificationSourceCheck,
    nowIso?: string
  ): VerificationResult {
    const now = nowIso ? new Date(nowIso) : new Date();
    const verifiedAt = now.toISOString();

    const deadline = opportunity.deadline ?? null;
    const deadlinePassed = deadline ? new Date(deadline).getTime() < now.getTime() : false;

    const sourceReachable = sourceCheck?.sourceReachable ?? true;
    const sourceCheckError = sourceCheck?.sourceCheckError;

    // Deterministic active logic:
    // Active if source reachable, deadline not passed, status not explicitly closed
    const status = (opportunity.status ?? '').toUpperCase();
    const isClosed = status.includes('CLOSED') || status.includes('EXPIRED') || status.includes('FILLED');
    const isActive = sourceReachable && !deadlinePassed && !isClosed;

    const confidence = this.computeConfidence(opportunity, sourceReachable, deadlinePassed);

    const notes: string[] = [];
    if (!sourceReachable) notes.push('Source unreachable');
    if (deadlinePassed) notes.push('Deadline passed');
    if (isClosed) notes.push(`Status indicates closed: ${status}`);

    return {
      opportunityId: opportunity.stableId ?? opportunity.externalId ?? `${opportunity.source}-${opportunity.title}`,
      source: opportunity.source,
      externalId: opportunity.externalId,
      verifiedAt,
      isActive,
      isExpired: deadlinePassed || isClosed,
      deadlinePassed,
      sourceReachable,
      sourceCheckError,
      deadline,
      currentStatus: sourceCheck?.fetchedStatus ?? status,
      confidence,
      notes: notes.length ? notes : undefined,
    };
  }

  /**
   * Verify deadline specifically
   */
  public verifyDeadline(opportunity: NormalizedOpportunity, nowIso?: string): boolean {
    if (!opportunity.deadline) return true;
    const now = nowIso ? new Date(nowIso) : new Date();
    const deadlineDate = new Date(opportunity.deadline);
    return deadlineDate.getTime() >= now.getTime();
  }

  /**
   * Batch verification stub
   */
  public verifyBatch(
    opportunities: NormalizedOpportunity[],
    sourceChecks?: Map<string, VerificationSourceCheck>,
    nowIso?: string
  ): VerificationResult[] {
    return opportunities.map(opp => {
      const check = sourceChecks?.get(this.opportunityKey(opp));
      return this.verify(opp, check, nowIso);
    });
  }

  private computeConfidence(
    opp: NormalizedOpportunity,
    sourceReachable: boolean,
    deadlinePassed: boolean
  ): number {
    let confidence = 0.5;
    if (sourceReachable) confidence += 0.3;
    if (opp.url && opp.applicationUrl) confidence += 0.1;
    if (opp.provenance?.confidence) confidence = Math.max(confidence, opp.provenance.confidence);
    if (deadlinePassed) confidence *= 0.5;
    return Math.min(1, Math.max(0, confidence));
  }

  private opportunityKey(opp: NormalizedOpportunity): string {
    return `${opp.source}:${opp.externalId ?? opp.stableId ?? opp.title}`;
  }
}
