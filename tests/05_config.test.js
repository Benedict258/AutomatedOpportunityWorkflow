#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', 'shared', 'config');
const files = ['default.yaml','development.yaml','production.yaml'];

console.log('=== Configuration Verification ===');
let allPass = true;

files.forEach(f => {
  const p = path.join(CONFIG_DIR, f);
  if (!fs.existsSync(p)) {
    console.log(`FAIL: ${f} missing`);
    allPass = false;
    return;
  }
  const content = fs.readFileSync(p,'utf8');
  const hasApp = content.includes('app:');
  const hasSources = content.includes('sources:');
  const isDefault = f === 'default.yaml';
  const status = (isDefault ? (hasApp && hasSources) : (content.trim().length > 0)) ? 'PASS' : 'BLOCKED';
  console.log(`${status}: ${f}`);
  if (status !== 'PASS') allPass = false;
});

// Check schema file
const schemaPath = path.join(__dirname, '..', 'shared', 'src', 'config', 'schema.ts');
if (fs.existsSync(schemaPath)) {
  const content = fs.readFileSync(schemaPath,'utf8');
  if (content.includes('AppConfigSchema')) {
    console.log('PASS: AppConfigSchema exists');
  } else {
    console.log('FAIL: AppConfigSchema missing');
    allPass = false;
  }
} else {
  console.log('FAIL: schema.ts missing');
  allPass = false;
}

// Check loader
const loaderPath = path.join(__dirname, '..', 'shared', 'src', 'config', 'loader.ts');
if (fs.existsSync(loaderPath)) {
  console.log('PASS: loader.ts exists');
} else {
  console.log('FAIL: loader.ts missing');
  allPass = false;
}

console.log(allPass ? 'RESULT: PASS' : 'RESULT: FAIL');
process.exit(allPass ? 0 : 1);
