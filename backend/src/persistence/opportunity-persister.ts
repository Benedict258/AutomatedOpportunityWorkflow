import type { NormalizedOpportunity } from '../adapters/types';
import { DeadlineType } from '../../../shared/src/enums';

// Simplified persister for STEP 8 demonstration
// In production, use Drizzle ORM with proper transactions

export interface PersistResult {
  inserted: number;
  updated: number;
  skipped: number;
  opportunities: Array<{ id: string; stableId: string; externalId: string }>;
}

export class OpportunityPersister {
  // For demo, use in-memory store or mock DB operations
  // Real implementation would use pg client
  private sourceIdMap = new Map<string, string>(); // source_id -> internal source UUID

  constructor(private dbClient?: any) {
    // Map known source
    this.sourceIdMap.set('gov_usajobs_001', '00000000-0000-0000-0000-000000000001');
  }

  async persist(normalized: NormalizedOpportunity[]): Promise<PersistResult> {
    const result: PersistResult = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      opportunities: []
    };

    for (const opp of normalized) {
      try {
        // Validate required fields
        if (!opp.title || !opp.sourceId) {
          result.skipped++;
          continue;
        }

        // Deduplication check: source + external_id
        const sourceInternalId = this.resolveSourceId(opp.sourceId);
        const externalId = opp.externalId ?? '';
        const urlFingerprint = opp.url ? opp.url.toLowerCase().trim() : '';

        // Simulate DB upsert
        const existing = await this.findExisting(sourceInternalId, externalId, urlFingerprint);
        
        if (existing) {
          // Update last_seen_at
          await this.updateOpportunity(existing.id, opp);
          result.updated++;
          result.opportunities.push({
            id: existing.id,
            stableId: existing.stableId,
            externalId
          });
        } else {
          // Insert new
          const id = await this.insertOpportunity(opp, sourceInternalId);
          await this.createVersion(id, opp, 1);
          result.inserted++;
          result.opportunities.push({
            id,
            stableId: crypto.randomUUID(),
            externalId
          });
        }
      } catch (err) {
        console.error('Persist error for opportunity', opp.externalId, err);
        result.skipped++;
      }
    }

    return result;
  }

  private resolveSourceId(sourceId: string): string {
    const internal = this.sourceIdMap.get(sourceId);
    if (!internal) {
      throw new Error(`Source ${sourceId} not mapped to internal ID`);
    }
    return internal;
  }

  private async findExisting(sourceInternalId: string, externalId: string, urlFingerprint: string): Promise<{ id: string; stableId: string } | null> {
    // TODO: SELECT id, stable_id FROM opportunities WHERE source_id = $1 AND (external_id = $2 OR url = $3)
    // For demo, return null to simulate insert
    return null;
  }

  private async insertOpportunity(opp: NormalizedOpportunity, sourceInternalId: string): Promise<string> {
    const id = crypto.randomUUID();
    // TODO: INSERT INTO opportunities (...)
    console.log(`INSERT opportunities id=${id} source_id=${sourceInternalId} external_id=${opp.externalId} title=${opp.title}`);
    return id;
  }

  private async updateOpportunity(id: string, opp: NormalizedOpportunity): Promise<void> {
    // TODO: UPDATE opportunities SET last_seen_at = NOW() WHERE id = $1
    console.log(`UPDATE opportunities id=${id}`);
  }

  private async createVersion(opportunityId: string, opp: NormalizedOpportunity, versionNumber: number): Promise<void> {
    // TODO: INSERT INTO opportunity_versions (...)
    console.log(`CREATE opportunity_versions opportunity_id=${opportunityId} version=${versionNumber}`);
  }
}
