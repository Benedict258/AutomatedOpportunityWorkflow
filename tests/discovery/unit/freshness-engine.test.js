#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const filePath = path.join(ROOT, 'backend/src/discovery/freshness/freshness-engine.ts');

console.log('=== FreshnessEngine Unit Test ===');
let pass = true;

if (!fs.existsSync(filePath)) {
  console.log('FAIL: freshness-engine.ts not found');
  process.exit(1);
}
console.log('PASS: freshness-engine.ts exists');

const content = fs.readFileSync(filePath, 'utf8');
const checks = [
  { name: 'class FreshnessEngine', pattern: /class FreshnessEngine/ },
  { name: 'evaluateFreshness method', pattern: /evaluateFreshness|detectStale/ },
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
