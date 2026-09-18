#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const filePath = path.join(ROOT, 'backend/src/discovery/versioning/version-manager.ts');

console.log('=== VersionManager Unit Test ===');
let pass = true;

if (!fs.existsSync(filePath)) {
  console.log('FAIL: version-manager.ts not found');
  process.exit(1);
}
console.log('PASS: version-manager.ts exists');

const content = fs.readFileSync(filePath, 'utf8');
const checks = [
  { name: 'class VersionManager', pattern: /class VersionManager/ },
  { name: 'version method', pattern: /getVersion|setVersion|checkVersion/ },
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
