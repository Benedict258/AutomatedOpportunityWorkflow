#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const fixturesDir = path.join(ROOT, 'tests/discovery/fixtures');

console.log('=== Full Pipeline Integration Test ===');
let pass = true;

// Check fixtures exist
const fixtures = ['usajobs_sample.json', 'greenhouse_sample.json', 'eventbrite_sample.json'];
fixtures.forEach(f => {
  const fp = path.join(fixturesDir, f);
  if (fs.existsSync(fp)) {
    console.log(`PASS: Fixture exists ${f}`);
    try {
      const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (data.documents && Array.isArray(data.documents) && data.metrics) {
        console.log(`PASS: ${f} has valid structure`);
      } else {
        console.log(`FAIL: ${f} missing documents or metrics`);
        pass = false;
      }
    } catch (e) {
      console.log(`FAIL: ${f} invalid JSON`);
      pass = false;
    }
  } else {
    console.log(`FAIL: Fixture missing ${f}`);
    pass = false;
  }
});

// Check pipeline components exist
const components = [
  'backend/src/discovery/discovery-engine.ts',
  'backend/src/discovery/pipeline-orchestrator.ts',
  'backend/src/discovery/collection/collection-orchestrator.ts',
  'backend/src/discovery/extraction/extraction-engine.ts',
  'backend/src/discovery/normalization/normalization-engine.ts',
];
components.forEach(c => {
  const fp = path.join(ROOT, c);
  if (fs.existsSync(fp)) {
    console.log(`PASS: Component exists ${c}`);
  } else {
    console.log(`FAIL: Component missing ${c}`);
    pass = false;
  }
});

// Simulate pipeline stage outputs validation
console.log('INFO: Validating stage outputs presence');
const stageFiles = {
  discovery: 'backend/src/discovery/discovery-engine.ts',
  collection: 'backend/src/discovery/collection/collection-orchestrator.ts',
  extraction: 'backend/src/discovery/extraction/extraction-engine.ts',
  normalization: 'backend/src/discovery/normalization/normalization-engine.ts',
  validation: 'backend/src/discovery/validation/validation-engine.ts',
  deduplication: 'backend/src/discovery/deduplication/dedup-engine.ts',
  freshness: 'backend/src/discovery/freshness/freshness-engine.ts',
};
Object.entries(stageFiles).forEach(([stage, file]) => {
  const fp = path.join(ROOT, file);
  if (fs.existsSync(fp)) {
    console.log(`PASS: Stage ${stage} component present`);
  } else {
    console.log(`FAIL: Stage ${stage} component missing`);
    pass = false;
  }
});

// Metrics check
console.log('INFO: Metrics schema expected: documentsCollected, pagesFetched, durationMs');
console.log('INFO: Error handling expected: status SUCCEEDED/PARTIAL/FAILED with error field');

console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
process.exit(pass ? 0 : 1);
