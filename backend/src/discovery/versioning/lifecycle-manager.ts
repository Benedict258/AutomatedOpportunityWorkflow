import { LifecycleState, VersionEvent, VersionEventType } from './types';
import { randomUUID } from 'crypto';
import { versionManager } from './version-manager';

function nowISO(): string {
  return new Date().toISOString();
}

type TransitionRule = {
  from: LifecycleState;
  to: LifecycleState;
  allowed: boolean;
  condition?: (meta?: any) => boolean;
};

const TRANSITIONS: TransitionRule[] = [
  { from: LifecycleState.NEW, to: LifecycleState.ACTIVE, allowed: true },
  { from: LifecycleState.ACTIVE, to: LifecycleState.STALE, allowed: true },
  { from: LifecycleState.STALE, to: LifecycleState.EXPIRED, allowed: true },
  { from: LifecycleState.EXPIRED, to: LifecycleState.CLOSED, allowed: true },
  { from: LifecycleState.ACTIVE, to: LifecycleState.CLOSED, allowed: true },
  { from: LifecycleState.STALE, to: LifecycleState.CLOSED, allowed: true },
  // No backwards transitions
];

export class LifecycleManager {
  canTransition(current: LifecycleState, next: LifecycleState): boolean {
    if (current === next) return true;
    const rule = TRANSITIONS.find(r => r.from === current && r.to === next);
    return rule?.allowed ?? false;
  }

  transition(opportunityId: string, targetState: LifecycleState, reason?: string): { success: boolean; previousState?: LifecycleState; newState?: LifecycleState; event?: VersionEvent; error?: string } {
    const meta = versionManager.getMeta(opportunityId);
    const currentState = meta?.state ?? LifecycleState.NEW;

    if (!this.canTransition(currentState, targetState)) {
      return {
        success: false,
        previousState: currentState,
        newState: targetState,
        error: `Transition from ${currentState} to ${targetState} is not allowed`,
      };
    }

    // Update meta state
    const updatedMeta = { ...meta! };
    updatedMeta.state = targetState;
    updatedMeta.modifiedAt = nowISO();
    // Reflect in version manager via internal meta map access (simplified)
    // For in-memory stub, we directly mutate via private access workaround
    // We'll just call a helper to update state
    this.updateMetaState(opportunityId, targetState, updatedMeta);

    const event: VersionEvent = {
      eventId: randomUUID(),
      opportunityId,
      eventType: targetState === LifecycleState.CLOSED ? VersionEventType.CLOSED : VersionEventType.STATE_CHANGED,
      timestamp: nowISO(),
      previousState: currentState,
      newState: targetState,
      metadata: { reason },
    };

    return {
      success: true,
      previousState: currentState,
      newState: targetState,
      event,
    };
  }

  private updateMetaState(opportunityId: string, state: LifecycleState, meta?: any) {
    // Access internal map via versionManager - using a private method for stub
    // In real implementation, this would be via repository
    // For in-memory stub, we replicate update logic
    const current = versionManager.getMeta(opportunityId);
    if (current) {
      current.state = state;
      current.modifiedAt = nowISO();
    }
  }

  evaluate(opportunityId: string, daysSinceLastSeen?: number, daysUntilDeadline?: number): { suggestedState?: LifecycleState; reason?: string } {
    const meta = versionManager.getMeta(opportunityId);
    if (!meta) return {};

    const current = meta.state;

    // Simple heuristic rules
    if (current === LifecycleState.NEW) {
      return { suggestedState: LifecycleState.ACTIVE, reason: 'Initial activation' };
    }
    if (current === LifecycleState.ACTIVE && daysSinceLastSeen !== undefined && daysSinceLastSeen > 30) {
      return { suggestedState: LifecycleState.STALE, reason: 'No sighting for >30 days' };
    }
    if (current === LifecycleState.ACTIVE && daysUntilDeadline !== undefined && daysUntilDeadline < 0) {
      return { suggestedState: LifecycleState.EXPIRED, reason: 'Deadline passed' };
    }
    if (current === LifecycleState.STALE && daysSinceLastSeen !== undefined && daysSinceLastSeen > 90) {
      return { suggestedState: LifecycleState.EXPIRED, reason: 'Stale for >90 days' };
    }
    if (current === LifecycleState.EXPIRED) {
      return { suggestedState: LifecycleState.CLOSED, reason: 'Expired opportunity' };
    }

    return {};
  }

  getState(opportunityId: string): LifecycleState | undefined {
    return versionManager.getMeta(opportunityId)?.state;
  }

  getHistory(opportunityId: string): VersionEvent[] {
    // Stub: in real implementation, events would be stored
    return [];
  }
}

export const lifecycleManager = new LifecycleManager();
