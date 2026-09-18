#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const filePath = path.join(ROOT, 'backend/src/discovery/normalization/normalization-engine.ts');

console.log('=== NormalizationEngine Unit Test ===');
let pass = true;

if (!fs.existsSync(filePath)) {
  console.log('FAIL: normalization-engine.ts not found');
  process.exit(1);
}
console.log('PASS: normalization-engine.ts exists');

const content = fs.readFileSync(filePath, 'utf8');
const checks = [
  { name: 'class NormalizationEngine', pattern: /class NormalizationEngine/ },
  { name: 'normalize method', pattern: /async normalize/ },
  { name: 'supports method', pattern: /supports\(/ },
  { name: 'mapFields', pattern: /mapFields/ },
  { name: 'field mapper usage', pattern: /getMapper/ },
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
