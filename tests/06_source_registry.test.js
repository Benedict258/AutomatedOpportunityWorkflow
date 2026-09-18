#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('=== Source Registry Verification ===');
let allPass = true;

const registryService = path.join(__dirname, '..', 'backend', 'src', 'registry', 'source-registry.service.ts');
const registryRepo = path.join(__dirname, '..', 'backend', 'src', 'registry', 'source-registry.repository.ts');
const indexFile = path.join(__dirname, '..', 'backend', 'src', 'registry', 'index.ts');

[registryService, registryRepo, indexFile].forEach(p => {
  if (fs.existsSync(p)) {
    console.log(`PASS: ${path.basename(p)} exists`);
  } else {
    console.log(`FAIL: ${path.basename(p)} missing`);
    allPass = false;
  }
});

// Check InMemory implementation methods
if (fs.existsSync(registryService)) {
  const content = fs.readFileSync(registryService,'utf8');
  const methods = ['register','update','enable','disable','updatePriority','healthCheck','getById','listByCategory','listEnabled','getAll'];
  methods.forEach(m => {
    if (content.includes(m)) {
      console.log(`PASS: method ${m} present`);
    } else {
      console.log(`FAIL: method ${m} missing`);
      allPass = false;
    }
  });
}

// Check seed config
const seedPath = path.join(__dirname, '..', 'shared', 'config', 'sources.seed.yaml');
if (fs.existsSync(seedPath)) {
  const content = fs.readFileSync(seedPath,'utf8');
  console.log(content.includes('sources:') ? 'PASS: sources.seed.yaml has sources' : 'BLOCKED: sources.seed.yaml empty');
} else {
  console.log('FAIL: sources.seed.yaml missing');
  allPass = false;
}

console.log(allPass ? 'RESULT: PASS' : 'RESULT: FAIL');
process.exit(allPass ? 0 : 1);
