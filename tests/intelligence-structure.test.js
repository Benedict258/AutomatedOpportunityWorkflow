const fs = require('fs');
const path = require('path');

const intelligenceModules = [
  'extraction',
  'classification',
  'requirements',
  'eligibility',
  'candidate',
  'embeddings',
  'matching',
  'scoring',
  'value',
  'timing',
  'ranking',
  'explanation',
  'pipeline',
  'evaluation'
];

console.log('=== Phase 4 Intelligence Structure Tests ===\n');

let passed = 0;
let failed = 0;

for (const module of intelligenceModules) {
  const modulePath = path.join(__dirname, '..', 'backend', 'src', 'intelligence', module);
  try {
    if (!fs.existsSync(modulePath)) {
      console.log(`FAIL: ${module} - directory missing`);
      failed++;
      continue;
    }

    const files = fs.readdirSync(modulePath);
    const hasIndex = files.includes('index.ts');
    const hasTypes = files.includes('types.ts');

    if (hasIndex && hasTypes) {
      console.log(`PASS: ${module} - structure OK (${files.length} files)`);
      passed++;
    } else {
      console.log(`FAIL: ${module} - missing index.ts or types.ts`);
      failed++;
    }
  } catch (e) {
    console.log(`FAIL: ${module} - ${e.message}`);
    failed++;
  }
}

console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);