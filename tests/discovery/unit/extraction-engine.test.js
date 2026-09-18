#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const filePath = path.join(ROOT, 'backend/src/discovery/extraction/extraction-engine.ts');

console.log('=== ExtractionEngine Unit Test ===');
let pass = true;

if (!fs.existsSync(filePath)) {
  console.log('FAIL: extraction-engine.ts not found');
  process.exit(1);
}
console.log('PASS: extraction-engine.ts exists');

const content = fs.readFileSync(filePath, 'utf8');
const checks = [
  { name: 'class ExtractionEngine', pattern: /class ExtractionEngine/ },
  { name: 'extractDocument method', pattern: /async extractDocument/ },
  { name: 'extractBatch method', pattern: /async extractBatch/ },
  { name: 'registerExtractor', pattern: /registerExtractor/ },
  { name: 'confidence threshold', pattern: /confidenceThreshold/ },
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
