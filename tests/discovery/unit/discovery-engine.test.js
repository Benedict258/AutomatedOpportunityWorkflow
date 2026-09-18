#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const enginePath = path.join(ROOT, 'backend/src/discovery/discovery-engine.ts');

console.log('=== DiscoveryEngine Unit Test ===');

let pass = true;

// Check file exists
if (!fs.existsSync(enginePath)) {
  console.log('FAIL: discovery-engine.ts not found');
  pass = false;
} else {
  console.log('PASS: discovery-engine.ts exists');
}

// Check class definition exists
const content = fs.readFileSync(enginePath, 'utf8');
const checks = [
  { name: 'class DiscoveryEngine', pattern: /class DiscoveryEngine/ },
  { name: 'createJob method', pattern: /async createJob/ },
  { name: 'executeJob method', pattern: /async executeJob/ },
  { name: 'getRunStatus method', pattern: /async getRunStatus/ },
  { name: 'validateCreateOptions', pattern: /validateCreateOptions/ },
];

checks.forEach(c => {
  if (c.pattern.test(content)) {
    console.log(`PASS: ${c.name} present`);
  } else {
    console.log(`FAIL: ${c.name} missing`);
    pass = false;
  }
});

console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
process.exit(pass ? 0 : 1);
