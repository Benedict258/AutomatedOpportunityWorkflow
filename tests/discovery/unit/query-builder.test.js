#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const filePath = path.join(ROOT, 'backend/src/discovery/strategy/query-builder.ts');

console.log('=== QueryBuilder Unit Test ===');
let pass = true;

if (!fs.existsSync(filePath)) {
  console.log('FAIL: query-builder.ts not found');
  process.exit(1);
}
console.log('PASS: query-builder.ts exists');

const content = fs.readFileSync(filePath, 'utf8');
const checks = [
  { name: 'class QueryBuilder', pattern: /class QueryBuilder/ },
  { name: 'buildFromTemplate', pattern: /buildFromTemplate/ },
  { name: 'buildTaxonomyDrivenQuery', pattern: /buildTaxonomyDrivenQuery/ },
  { name: 'buildProfileAwareQuery', pattern: /buildProfileAwareQuery/ },
  { name: 'buildGeographicQuery', pattern: /buildGeographicQuery/ },
  { name: 'mergeFilters', pattern: /mergeFilters/ },
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
