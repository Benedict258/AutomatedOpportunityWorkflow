#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('=== Adapter Interface Verification ===');
let allPass = true;

const adaptersDir = path.join(__dirname, '..', 'backend', 'src', 'adapters');
const baseAdapter = path.join(adaptersDir, 'base-adapter.ts');
const interfaceFile = path.join(adaptersDir, 'source-adapter.interface.ts');
const usajobsAdapter = path.join(adaptersDir, 'usajobs-adapter.ts');

[baseAdapter, interfaceFile, usajobsAdapter].forEach(p => {
  console.log(fs.existsSync(p) ? `PASS: ${path.basename(p)} exists` : `FAIL: ${path.basename(p)} missing`);
  if (!fs.existsSync(p)) allPass = false;
});

if (fs.existsSync(interfaceFile)) {
  const content = fs.readFileSync(interfaceFile,'utf8');
  const methods = ['supports','discover','fetch','normalize','validate','get_metadata','health_check'];
  methods.forEach(m => {
    if (content.includes(m)) console.log(`PASS: interface method ${m}`);
    else { console.log(`FAIL: interface method ${m} missing`); allPass = false; }
  });
}

if (fs.existsSync(usajobsAdapter)) {
  const content = fs.readFileSync(usajobsAdapter,'utf8');
  const checks = [
    'adapterId = \'usajobs-api-adapter\'',
    'supports(source',
    'discover',
    'fetch',
    'normalize',
    'ping'
  ];
  checks.forEach(c => {
    if (content.includes(c)) console.log(`PASS: USAJobs adapter has ${c}`);
    else { console.log(`FAIL: USAJobs adapter missing ${c}`); allPass = false; }
  });
}

console.log(allPass ? 'RESULT: PASS' : 'RESULT: FAIL');
process.exit(allPass ? 0 : 1);
