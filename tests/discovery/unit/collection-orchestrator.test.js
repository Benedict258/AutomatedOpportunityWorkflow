#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const filePath = path.join(ROOT, 'backend/src/discovery/collection/collection-orchestrator.ts');

console.log('=== CollectionOrchestrator Unit Test ===');
let pass = true;

if (!fs.existsSync(filePath)) {
  console.log('FAIL: collection-orchestrator.ts not found');
  process.exit(1);
}
console.log('PASS: collection-orchestrator.ts exists');

const content = fs.readFileSync(filePath, 'utf8');
const checks = [
  { name: 'class CollectionOrchestrator', pattern: /class CollectionOrchestrator/ },
  { name: 'collect method', pattern: /async collect/ },
  { name: 'collectMany method', pattern: /async collectMany/ },
  { name: 'rate limiter usage', pattern: /RateLimiterRegistry/ },
  { name: 'wrapRawDocument', pattern: /wrapRawDocument/ },
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
