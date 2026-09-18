import { LifecycleState, OpportunityVersion, VersionEvent, VersionEventType, VersioningResult, CreateVersionInput, OpportunityLifecycleMeta } from './types';
import { randomUUID } from 'crypto';

function nowISO(): string {
  return new Date().toISOString();
}

function shallowDiff(prev?: Partial<OpportunityVersion>, curr?: Partial<CreateVersionInput>): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (!prev || !curr) return changes;
  const keys: (keyof CreateVersionInput)[] = ['title', 'description', 'applicationDeadline', 'deadlineType', 'location', 'url', 'status'];
  for (const key of keys) {
    const from = (prev as any)[key];
    const to = (curr as any)[key];
    if (from !== to) {
      changes[key as string] = { from, to };
    }
  }
  return changes;
}

export class VersionManager {
  private versions = new Map<string, OpportunityVersion[]>();
  private meta = new Map<string, OpportunityLifecycleMeta>();

  createVersion(input: CreateVersionInput): VersioningResult {
    try {
      const { opportunityId } = input;
      if (!opportunityId) {
        return { success: false, opportunityId, error: 'opportunityId is required' };
      }

      const existingVersions = this.versions.get(opportunityId) ?? [];
      const versionNumber = existingVersions.length + 1;
      const capturedAt = nowISO();

      const version: OpportunityVersion = {
        id: randomUUID(),
        opportunityId,
        versionNumber,
        capturedAt,
        title: input.title,
        description: input.description,
        applicationDeadline: input.applicationDeadline ?? null,
        deadlineType: input.deadlineType,
        location: input.location,
        url: input.url,
        status: input.status,
        changeMetadata: input.previousSnapshot ? shallowDiff(input.previousSnapshot, input) : undefined,
      };

      existingVersions.push(version);
      this.versions.set(opportunityId, existingVersions);

      const currentMeta = this.meta.get(opportunityId);
      const firstSeenAt = currentMeta?.firstSeenAt ?? capturedAt;
      const lastSeenAt = capturedAt;
      const modifiedAt = capturedAt;

      const meta: OpportunityLifecycleMeta = {
        opportunityId,
        firstSeenAt,
        lastSeenAt,
        modifiedAt,
        state: currentMeta?.state ?? LifecycleState.NEW,
        versionCount: versionNumber,
      };
      this.meta.set(opportunityId, meta);

      const event: VersionEvent = {
        eventId: randomUUID(),
        opportunityId,
        versionId: version.id,
        eventType: versionNumber === 1 ? VersionEventType.CREATED : VersionEventType.UPDATED,
        timestamp: capturedAt,
        metadata: { versionNumber },
      };

      return {
        success: true,
        opportunityId,
        version,
        meta,
        event,
      };
    } catch (err) {
      return {
        success: false,
        opportunityId: input.opportunityId,
        error: (err as Error).message,
      };
    }
  }

  getVersions(opportunityId: string): OpportunityVersion[] {
    return this.versions.get(opportunityId) ?? [];
  }

  getLatestVersion(opportunityId: string): OpportunityVersion | undefined {
    const versions = this.versions.get(opportunityId);
    if (!versions || versions.length === 0) return undefined;
    return versions[versions.length - 1];
  }

  getMeta(opportunityId: string): OpportunityLifecycleMeta | undefined {
    return this.meta.get(opportunityId);
  }

  updateSeen(opportunityId: string): void {
    const meta = this.meta.get(opportunityId);
    if (meta) {
      meta.lastSeenAt = nowISO();
      this.meta.set(opportunityId, meta);
    }
  }

  updateModified(opportunityId: string): void {
    const meta = this.meta.get(opportunityId);
    if (meta) {
      meta.modifiedAt = nowISO();
      this.meta.set(opportunityId, meta);
    }
  }

  detectChange(opportunityId: string, currentData: Partial<CreateVersionInput>): { changed: boolean; diff?: Record<string, unknown> } {
    const latest = this.getLatestVersion(opportunityId);
    if (!latest) return { changed: true };
    const diff = shallowDiff(latest, currentData);
    return { changed: Object.keys(diff).length > 0, diff };
  }
}

export const versionManager = new VersionManager();
