#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const required = [
  'backend/src/adapters',
  'backend/src/persistence',
  'backend/src/registry',
  'backend/migrations',
  'shared/src/domain',
  'shared/src/config',
  'shared/src/registry',
  'taxonomy',
  'docs',
  'docker-compose.yml',
  'package.json'
];

function checkPath(rel) {
  const full = path.join(ROOT, rel);
  return fs.existsSync(full) ? 'PASS' : 'FAIL';
}

console.log('=== Workspace Structure Verification ===');
let allPass = true;
required.forEach(p => {
  const status = checkPath(p);
  console.log(`${status}: ${p}`);
  if (status !== 'PASS') allPass = false;
});
console.log(allPass ? 'RESULT: PASS' : 'RESULT: FAIL');
process.exit(allPass ? 0 : 1);
