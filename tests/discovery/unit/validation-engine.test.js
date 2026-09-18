#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const filePath = path.join(ROOT, 'backend/src/discovery/validation/validation-engine.ts');

console.log('=== ValidationEngine Unit Test ===');
let pass = true;

if (!fs.existsSync(filePath)) {
  console.log('FAIL: validation-engine.ts not found');
  process.exit(1);
}
console.log('PASS: validation-engine.ts exists');

const content = fs.readFileSync(filePath, 'utf8');
const checks = [
  { name: 'class ValidationEngine', pattern: /class ValidationEngine/ },
  { name: 'validate method', pattern: /validate/ },
  { name: 'rules', pattern: /rules/ },
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
