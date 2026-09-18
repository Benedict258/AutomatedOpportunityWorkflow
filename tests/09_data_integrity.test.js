#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('=== Data Integrity Chain Verification ===');
let allPass = true;

const schemaPath = path.join(__dirname, '..', 'backend', 'migrations', '002_create_schema.sql');
if (!fs.existsSync(schemaPath)) {
  console.log('FAIL: schema file missing');
  process.exit(1);
}
const schema = fs.readFileSync(schemaPath,'utf8');

// Check source → opportunity FK
if (schema.includes('source_id UUID NOT NULL REFERENCES sources(id)') && schema.includes('CREATE TABLE IF NOT EXISTS opportunities')) {
  console.log('PASS: opportunities references sources');
} else {
  console.log('FAIL: opportunities → sources FK missing');
  allPass = false;
}

// Check opportunity → opportunity_versions FK
if (schema.includes('opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE') && schema.includes('CREATE TABLE IF NOT EXISTS opportunity_versions')) {
  console.log('PASS: opportunity_versions references opportunities');
} else {
  console.log('FAIL: opportunity_versions → opportunities FK missing');
  allPass = false;
}

// Check unique constraints
if (schema.includes('CONSTRAINT opportunities_source_external_unique UNIQUE (source_id, external_id)')) {
  console.log('PASS: opportunities unique constraint on source_id+external_id');
} else {
  console.log('FAIL: opportunities unique constraint missing');
  allPass = false;
}

// Check stable_id
if (schema.includes('stable_id UUID NOT NULL UNIQUE')) {
  console.log('PASS: opportunities has stable_id');
} else {
  console.log('FAIL: stable_id missing');
  allPass = false;
}

// Check embedding column
if (schema.includes('embedding VECTOR')) {
  console.log('PASS: embedding column present for pgvector');
} else {
  console.log('FAIL: embedding column missing');
  allPass = false;
}

// Check domain types exist
const oppTypePath = path.join(__dirname,'..','shared','src','domain','opportunity.ts');
const oppVerPath = path.join(__dirname,'..','shared','src','domain','opportunityVersion.ts');
const sourcePath = path.join(__dirname,'..','shared','src','domain','source.ts');

[oppTypePath, oppVerPath, sourcePath].forEach(p => {
  if (fs.existsSync(p)) console.log(`PASS: ${path.basename(p)} exists`);
  else { console.log(`FAIL: ${path.basename(p)} missing`); allPass = false; }
});

console.log(allPass ? 'RESULT: PASS' : 'RESULT: FAIL');
process.exit(allPass ? 0 : 1);
