#!/usr/bin/env node
/**
 * Simple DB verification script for Automated Opportunity Intelligence System
 * Checks connectivity, pgvector extension, and schema creation
 */

const { execSync } = require('child_process');

const DB_CONTAINER = 'opportunity_postgres';
const DB_USER = 'opp_user';
const DB_NAME = 'opportunity_intelligence';

function runPsq(query) {
  const cmd = `docker exec ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c "${query}"`;
  try {
    return execSync(cmd, { encoding: 'utf8' });
  } catch (e) {
    throw new Error(`psql failed: ${e.message}`);
  }
}

function log(msg) {
  console.log(`[VERIFY] ${msg}`);
}

function checkContainer() {
  log('Checking PostgreSQL container...');
  try {
    execSync(`docker ps --filter name=${DB_CONTAINER} --format "{{.Names}}"` , { encoding: 'utf8' });
    log('Container is running');
  } catch (e) {
    throw new Error('Container not running');
  }
}

function checkConnectivity() {
  log('Checking DB connectivity...');
  const result = runPsq('SELECT version();');
  if (!result.includes('PostgreSQL')) throw new Error('No PostgreSQL version');
  log('Connectivity OK');
}

function checkPgvector() {
  log('Checking pgvector extension...');
  const result = runPsq("SELECT extname FROM pg_extension WHERE extname='vector';");
  if (!result.includes('vector')) throw new Error('pgvector not installed');
  log('pgvector extension present');
}

function checkSchema() {
  log('Checking schema tables...');
  const tables = [
    'users','candidate_profiles','sources','opportunities','opportunity_versions',
    'opportunity_categories','skills','opportunity_skills','eligibility_requirements',
    'opportunity_eligibility','duplicate_groups','duplicate_members','news_items',
    'events','certifications','fellowships','notifications','notification_history',
    'application_references','system_configurations','benchmark_samples','benchmark_results'
  ];
  const query = `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['${tables.join("','")}']);`;
  const result = runPsq(query);
  const found = tables.filter(t => result.includes(t));
  log(`Found ${found.length}/${tables.length} tables`);
  if (found.length !== tables.length) {
    log('Missing tables: ' + tables.filter(t => !found.includes(t)).join(', '));
    throw new Error('Schema incomplete');
  }
  log('Schema tables present');
}

function checkEmbeddingColumn() {
  log('Checking embedding column...');
  const result = runPsq("SELECT column_name FROM information_schema.columns WHERE table_name='opportunities' AND column_name='embedding';");
  if (!result.includes('embedding')) throw new Error('Embedding column missing');
  log('Embedding column present');
}

function checkIndexes() {
  log('Checking key indexes...');
  const result = runPsq("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='opportunities' AND indexname LIKE 'idx_opportunities_%';");
  if (!result.includes('idx_opportunities_stable_id')) throw new Error('Indexes missing');
  log('Indexes present');
}

try {
  checkContainer();
  checkConnectivity();
  checkPgvector();
  checkSchema();
  checkEmbeddingColumn();
  checkIndexes();
  console.log('\n✅ Verification PASSED: Database is ready');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Verification FAILED:', err.message);
  process.exit(1);
}
