#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'backend', 'migrations');
const files = ['001_create_extensions.sql','002_create_schema.sql','003_create_indexes.sql'];

console.log('=== Database Schema Verification ===');
let allPass = true;

files.forEach(f => {
  const p = path.join(MIGRATIONS_DIR, f);
  if (!fs.existsSync(p)) {
    console.log(`FAIL: ${f} missing`);
    allPass = false;
    return;
  }
  const content = fs.readFileSync(p,'utf8');
  console.log(`PASS: ${f} exists`);
  if (f === '001_create_extensions.sql' && !content.includes('vector')) {
    console.log('BLOCKED: pgvector extension not referenced');
    allPass = false;
  }
  if (f === '002_create_schema.sql') {
    const tables = ['users','sources','opportunities','opportunity_versions','opportunity_categories','skills','opportunity_skills','eligibility_requirements','opportunity_eligibility','duplicate_groups','duplicate_members','news_items','events','certifications','fellowships','notifications','notification_history','application_references','system_configurations','benchmark_samples','benchmark_results'];
    tables.forEach(t => {
      if (!content.includes(`CREATE TABLE IF NOT EXISTS ${t}`)) {
        console.log(`FAIL: table ${t} missing`);
        allPass = false;
      }
    });
    if (content.includes('embedding VECTOR')) {
      console.log('PASS: embedding VECTOR column present');
    } else {
      console.log('FAIL: embedding VECTOR column missing');
      allPass = false;
    }
  }
});

// Verify verify-db.js exists
const verifyDb = path.join(__dirname, '..', 'backend', 'scripts', 'verify-db.js');
console.log(fs.existsSync(verifyDb) ? 'PASS: verify-db.js exists' : 'FAIL: verify-db.js missing');
if (!fs.existsSync(verifyDb)) allPass = false;

console.log(allPass ? 'RESULT: PASS' : 'RESULT: FAIL');
process.exit(allPass ? 0 : 1);
