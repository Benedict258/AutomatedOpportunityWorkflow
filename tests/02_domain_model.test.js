#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DOMAIN_DIR = path.join(__dirname, '..', 'shared', 'src', 'domain');
const files = [
  'user.ts','candidate.ts','source.ts','opportunity.ts','opportunityVersion.ts',
  'skill.ts','eligibility.ts','duplicate.ts','news.ts','event.ts','certification.ts',
  'fellowship.ts','notification.ts','application.ts','configuration.ts','benchmark.ts',
  'validation.ts','index.ts'
];

console.log('=== Domain Model Verification ===');
let allPass = true;
files.forEach(f => {
  const p = path.join(DOMAIN_DIR, f);
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p,'utf8');
    const hasExport = /export\s/.test(content);
    const status = hasExport ? 'PASS' : 'BLOCKED';
    console.log(`${status}: ${f} ${hasExport?'has exports':''}`);
    if (!hasExport) allPass = false;
  } else {
    console.log(`FAIL: ${f} missing`);
    allPass = false;
  }
});

// Check enums
const enumsPath = path.join(__dirname, '..', 'shared', 'src', 'enums.ts');
if (fs.existsSync(enumsPath)) {
  console.log('PASS: enums.ts exists');
} else {
  console.log('FAIL: enums.ts missing');
  allPass = false;
}

console.log(allPass ? 'RESULT: PASS' : 'RESULT: FAIL');
process.exit(allPass ? 0 : 1);
