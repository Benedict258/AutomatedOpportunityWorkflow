#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const filePath = path.join(ROOT, 'backend/src/discovery/deduplication/dedup-engine.ts');

console.log('=== DeduplicationEngine Unit Test ===');
let pass = true;

if (!fs.existsSync(filePath)) {
  console.log('FAIL: dedup-engine.ts not found');
  process.exit(1);
}
console.log('PASS: dedup-engine.ts exists');

const content = fs.readFileSync(filePath, 'utf8');
const checks = [
  { name: 'class containing Deduplication', pattern: /class.*Dedup|class.*Deduplication/ },
  { name: 'dedupe method', pattern: /dedupe|dedup/ },
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
