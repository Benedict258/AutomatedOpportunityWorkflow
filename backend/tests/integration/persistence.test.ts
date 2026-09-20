import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPool, closePool } from '../../src/db/connection.js';
import { PgOpportunityRepository } from '../../src/persistence/pg-opportunity-repository.js';
import { PgEmbeddingRepository } from '../../src/persistence/pg-embedding-repository.js';

const dummyVector = Array.from({ length: 2048 }, (_, i) => Math.sin(i) * 0.01);

describe('Persistence integration', () => {
  const oppRepo = new PgOpportunityRepository();
  const embRepo = new PgEmbeddingRepository();

  beforeAll(async () => {
    // ensure connection
    const ok = await getPool().query('SELECT 1');
    expect(ok.rowCount).toBe(1);
  });

  afterAll(async () => {
    await closePool();
  });

  it('inserts an opportunity with embedding and retrieves it', async () => {
    // Use a known source UUID from seed or create a source quickly
    const sourceRes = await getPool().query(`INSERT INTO sources (name, url, source_type) VALUES ('test_source','http://test','test') RETURNING id;`);
    const sourceId = sourceRes.rows[0].id;

    const opp = await oppRepo.upsert({
      title: 'Test Opportunity',
      sourceId,
      externalId: 'ext-123',
      organization: 'Test Org',
      description: 'Desc',
      url: 'http://example.com',
      location: 'Remote',
      remoteInfo: null,
      opportunityType: 'grant',
      categoryIds: [],
      status: 'active',
      publicationDate: null,
      applicationDeadline: null,
      deadlineType: 'hard',
      lifecycleStage: 'published',
    } as any, sourceId, dummyVector);

    expect(opp.id).toBeDefined();
    expect(opp.title).toBe('Test Opportunity');
    expect(opp.embedding).toBeDefined();
    expect(opp.embedding!.length).toBe(2048);

    const fetched = await oppRepo.getById(opp.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.title).toBe('Test Opportunity');
  });

  it('cosine similarity search returns the inserted embedding', async () => {
    const sourceRes = await getPool().query(`INSERT INTO sources (name, url, source_type) VALUES ('test_source2','http://test2','test') RETURNING id;`);
    const sourceId = sourceRes.rows[0].id;

    const opp = await oppRepo.upsert({
      title: 'Similarity Test',
      sourceId,
      externalId: 'ext-sim',
      organization: 'Org',
      description: 'Desc',
      url: 'http://example.com',
      location: 'Remote',
      remoteInfo: null,
      opportunityType: 'grant',
      categoryIds: [],
      status: 'active',
      publicationDate: null,
      applicationDeadline: null,
      deadlineType: 'hard',
      lifecycleStage: 'published',
    } as any, sourceId, dummyVector);

    // Insert embedding metadata & vector via embedding repo
    const meta = await embRepo.insertMetadata({
      entity_type: 'opportunity',
      entity_id: opp.id,
      model: 'nvidia/nemotron-3-embed-1b',
      model_version: '1',
      provider: 'nvidia',
      dimensions: 2048,
      version: 1,
      source_text_hash: 'hash123',
    });
    await embRepo.insertEmbedding(meta.id, dummyVector);

    const results = await embRepo.cosineSimilaritySearch(dummyVector, 5, 'opportunity');
    expect(results.length).toBeGreaterThanOrEqual(1);
    const top = results[0];
    expect(top.metadata.entity_id).toBe(opp.id);
    expect(top.similarity).toBeGreaterThan(0.99); // identical vector
  });
});