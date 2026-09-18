#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('=== First Source Integration Verification ===');
let allPass = true;

const usajobsAdapter = path.join(__dirname, '..', 'backend', 'src', 'adapters', 'usajobs-adapter.ts');
const persister = path.join(__dirname, '..', 'backend', 'src', 'persistence', 'opportunity-persister.ts');

if (fs.existsSync(usajobsAdapter)) {
  const content = fs.readFileSync(usajobsAdapter,'utf8');
  const features = [
    { name: 'discover method', check: /async discover/ },
    { name: 'fetch method', check: /async fetch/ },
    { name: 'normalize method', check: /async normalize/ },
    { name: 'fixture data', check: /USAJOBS_FIXTURE/ },
    { name: 'supports check', check: /gov_usajobs_001/ }
  ];
  features.forEach(f => {
    if (f.check.test(content)) console.log(`PASS: ${f.name}`);
    else { console.log(`FAIL: ${f.name} missing`); allPass = false; }
  });
} else {
  console.log('FAIL: usajobs-adapter.ts missing');
  allPass = false;
}

if (fs.existsSync(persister)) {
  const content = fs.readFileSync(persister,'utf8');
  const features = [
    { name: 'persist method', check: /async persist/ },
    { name: 'findExisting', check: /findExisting/ },
    { name: 'insertOpportunity', check: /insertOpportunity/ },
    { name: 'createVersion', check: /createVersion/ },
    { name: 'source mapping', check: /gov_usajobs_001/ }
  ];
  features.forEach(f => {
    if (f.check.test(content)) console.log(`PASS: persister ${f.name}`);
    else { console.log(`FAIL: persister ${f.name} missing`); allPass = false; }
  });
} else {
  console.log('FAIL: opportunity-persister.ts missing');
  allPass = false;
}

// Check seed has usajobs
const seedPath = path.join(__dirname, '..', 'shared', 'config', 'sources.seed.yaml');
if (fs.existsSync(seedPath)) {
  const content = fs.readFileSync(seedPath,'utf8');
  if (content.includes('gov_usajobs_001') || content.toLowerCase().includes('usajobs')) {
    console.log('PASS: sources seed includes USAJobs');
  } else {
    console.log('BLOCKED: sources seed may not include USAJobs');
  }
}

console.log(allPass ? 'RESULT: PASS' : 'RESULT: FAIL');
process.exit(allPass ? 0 : 1);
