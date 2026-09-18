#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const filePath = path.join(ROOT, 'backend/src/discovery/pipeline/pipeline.ts');

console.log('=== Pipeline Unit Test ===');
let pass = true;

if (!fs.existsSync(filePath)) {
  console.log('FAIL: pipeline.ts not found');
  process.exit(1);
}
console.log('PASS: pipeline.ts exists');

const content = fs.readFileSync(filePath, 'utf8');
const checks = [
  { name: 'class DiscoveryPipeline', pattern: /class DiscoveryPipeline/ },
  { name: 'run method', pattern: /async run/ },
  { name: 'stages definition', pattern: /stage|Stage/ },
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
