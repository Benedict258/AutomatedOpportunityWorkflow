#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const tests = [
  '01_workspace_structure.test.js',
  '02_domain_model.test.js',
  '03_taxonomy.test.js',
  '04_db_schema.test.js',
  '05_config.test.js',
  '06_source_registry.test.js',
  '07_adapter_interface.test.js',
  '08_first_source_integration.test.js',
  '09_data_integrity.test.js'
];

console.log('=== Foundation Testing & Verification Summary ===\n');
const results = [];

tests.forEach(t => {
  const file = path.join(__dirname, t);
  try {
    console.log(`Running ${t}...`);
    execSync(`node "${file}"`, { stdio: 'inherit' });
    results.push({ test: t, status: 'PASS' });
  } catch (e) {
    results.push({ test: t, status: 'FAIL' });
  }
  console.log('');
});

console.log('=== Results ===');
results.forEach(r => {
  console.log(`${r.status}: ${r.test}`);
});

const passed = results.filter(r => r.status === 'PASS').length;
console.log(`\nTotal: ${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
