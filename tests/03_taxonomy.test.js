#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const TAXONOMY_DIR = path.join(__dirname, '..', 'taxonomy');
const yamlFiles = fs.readdirSync(TAXONOMY_DIR).filter(f => f.endsWith('.yaml'));

console.log('=== Taxonomy Verification ===');
let allPass = true;

if (yamlFiles.length === 0) {
  console.log('FAIL: No YAML files found');
  process.exit(1);
}

yamlFiles.forEach(file => {
  const full = path.join(TAXONOMY_DIR, file);
  const content = fs.readFileSync(full,'utf8');
  const hasNodes = content.includes('nodes:');
  const hasId = /id:\s*\S+/.test(content);
  const hasName = /name:\s*\S+/.test(content);
  const status = hasNodes && hasId && hasName ? 'PASS' : 'FAIL';
  console.log(`${status}: ${file} nodes=${hasNodes} id=${hasId} name=${hasName}`);
  if (status !== 'PASS') allPass = false;
});

// Validate script exists
const validateScript = path.join(TAXONOMY_DIR, 'validate.js');
console.log(fs.existsSync(validateScript) ? 'PASS: validate.js exists' : 'FAIL: validate.js missing');
if (!fs.existsSync(validateScript)) allPass = false;

console.log(allPass ? 'RESULT: PASS' : 'RESULT: FAIL');
process.exit(allPass ? 0 : 1);
