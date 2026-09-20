import pg from 'pg';

const { Pool } = pg;

async function main() {
  // Load from environment or fallback to known test values
  const connectionString = process.env.DATABASE_URL || 'postgres://user:pwd@host:6543/postgres?sslmode=require';
  const ssl = (process.env.DATABASE_SSL === 'true') ? { rejectUnauthorized: false } : false;
  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString, ssl });

  try {
    // Ensure pgvector extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');

    // Create temp table for vector test
    await pool.query('CREATE TEMP TABLE test_vec (embedding vector(2048));');

    // Generate random 2048-dim vector
    const vec1 = Array.from({ length: 2048 }, () => Math.random() * 2 - 1);
    const vec2 = Array.from({ length: 2048 }, () => Math.random() * 2 - 1);

    // Insert first vector
    await pool.query('INSERT INTO test_vec (embedding) VALUES ($1)', [vec1]);

    // Retrieve and assert length
    const res = await pool.query('SELECT vector_dims(embedding) AS dims FROM test_vec LIMIT 1');
    const dims = Number(res.rows[0].dims);
    if (dims !== 2048) throw new Error(`Vector dims mismatch: ${dims}`);
    console.log('VECTOR_INSERT_OK');
    console.log('VECTOR_RETRIEVE_OK');

    // Cosine similarity with second vector
    const simRes = await pool.query(
      'SELECT 1 - (embedding <=> $1) AS cosine FROM test_vec LIMIT 1',
      [vec2]
    );
    const cosine = Number(simRes.rows[0].cosine);
    if (Number.isNaN(cosine) || cosine < -1 || cosine > 1) {
      throw new Error(`Cosine similarity out of range: ${cosine}`);
    }
    console.log('COSINE_OK');
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();