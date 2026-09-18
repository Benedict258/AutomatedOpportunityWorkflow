#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const tests = [
  'unit/discovery-engine.test.js',
  'unit/query-builder.test.js',
  'unit/collection-orchestrator.test.js',
  'unit/extraction-engine.test.js',
  'unit/normalization-engine.test.js',
  'unit/validation-engine.test.js',
  'unit/deduplication-engine.test.js',
  'unit/freshness-engine.test.js',
  'unit/version-manager.test.js',
  'unit/pipeline.test.js',
  'integration/full-pipeline.test.js',
];

console.log('=== Discovery Pipeline Tests ===\n');
const results = [];

tests.forEach(t => {
  const file = path.join(__dirname, t);
  try {
    console.log(`Running ${t}...`);
    execSync(`node "${file}"`, { stdio: 'inherit' });
    results.push({ test: t, status: 'PASS' });
  } catch (e) {
    results.push({ test: t, status: 'FAIL' });
  }
  console.log('');
});

console.log('=== Results ===');
results.forEach(r => console.log(`${r.status}: ${r.test}`));
const passed = results.filter(r => r.status === 'PASS').length;
console.log(`\nTotal: ${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
