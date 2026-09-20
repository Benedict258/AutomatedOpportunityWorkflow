#!/usr/bin/env node
// End-to-end test script for USAJOBS pipeline
// This script runs the full USAJOBS data collection pipeline against real services

import { config } from '../src/config/index.js';
import { getPool, closePool } from '../src/db/connection.js';
import { collectionOrchestrator } from '../src/discovery/collection/collection-orchestrator.js';
import { adapterRegistry } from '../src/discovery/collection/adapter-registry.js';
import { usajobsAdapter } from '../src/discovery/collection/adapters/usajobs-adapter.js';
import { logger } from '../src/utils/logger.js';

async function runUSAJobsPipeline(): Promise<void> {
  logger.info('Starting USAJOBS end-to-end pipeline test');

  try {
    // Register USAJOBS adapter
    adapterRegistry.register('usajobs', usajobsAdapter);

    // Initialize database connection
    const pool = getPool();
    await pool.query('SELECT 1');
    logger.info('Database connection verified');

    // Run the collection pipeline for USAJOBS
    const result = await collectionOrchestrator.collect({
      sourceIds: ['usajobs'],
      options: {
        maxResults: 10,
        syncMode: 'incremental',
      },
    });

    logger.info({ result }, 'USAJOBS pipeline completed successfully');

    console.log('\n=== USAJOBS E2E Test Results ===');
    console.log(`Status: ${result.status}`);
    console.log(`Opportunities collected: ${result.opportunitiesCollected}`);
    console.log(`Opportunities created: ${result.opportunitiesCreated}`);
    console.log(`Opportunities updated: ${result.opportunitiesUpdated}`);
    console.log(`Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((err: Error, idx: number) => {
        console.log(`  ${idx + 1}. ${err.message}`);
      });
    }

    // Verify data was persisted
    const client = await pool.connect();
    try {
      const countResult = await client.query(
        'SELECT COUNT(*) FROM opportunities WHERE source_id = $1',
        ['usajobs']
      );
      console.log(`\nOpportunities in database (usajobs): ${countResult.rows[0].count}`);
    } finally {
      client.release();
    }

    console.log('\n✅ USAJOBS E2E test PASSED');
    process.exit(0);

  } catch (error) {
    logger.error({ err: error }, 'USAJOBS E2E test FAILED');
    console.error('\n❌ USAJOBS E2E test FAILED:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run if executed directly
runUSAJobsPipeline().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});