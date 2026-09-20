import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fastify from 'fastify';
import { webhookRoutes } from '../../src/routes/webhook';
import { PgEmbeddingRepository } from '../../src/persistence/pg-embedding-repository';
import { getPool } from '../../src/db/connection';

describe('Intelligence pipeline integration', () => {
  let app: fastify.FastifyInstance;
  const embRepo = new PgEmbeddingRepository();

  beforeAll(async () => {
    app = fastify({ logger: false });
    await app.register(webhookRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('posts discovery-complete webhook and creates opportunity embedding and match', async () => {
    const payload = {
      runId: 'test-run-1',
      status: 'completed',
      opportunityId: 'opp-test-1',
      candidateId: 'cand-test-1',
      sourceId: 'src-1',
      rawContent: 'Sample opportunity description for testing.',
      candidateProfile: { skills: ['TypeScript', 'Node.js'], experience: ['3 years backend'] }
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/discovery-complete',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'test-run-1'
      },
      payload
    });

    expect(response.statusCode).toBe(202);

    // Verify opportunity embedding persisted
    const oppEmb = await embRepo.getByEntity('opportunity', 'opp-test-1');
    expect(oppEmb).not.toBeNull();
    expect(oppEmb!.embedding.embedding.length).toBe(2048);

    // Verify candidate embedding persisted
    const candEmb = await embRepo.getByEntity('candidate', 'cand-test-1');
    expect(candEmb).not.toBeNull();
    expect(candEmb!.embedding.embedding.length).toBe(2048);

    // Verify match row (we can query embeddings cosine similarity search)
    const matches = await embRepo.cosineSimilaritySearch(oppEmb!.embedding.embedding, 5, 'candidate');
    expect(matches.length).toBeGreaterThan(0);
    const top = matches[0];
    expect(top.metadata.entity_id).toBe('cand-test-1');
    expect(typeof top.similarity).toBe('number');
    expect(top.similarity).toBeGreaterThanOrEqual(0);
    expect(top.similarity).toBeLessThanOrEqual(1);
  });
});