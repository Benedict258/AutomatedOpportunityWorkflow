const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, 'shared', 'src');
const files = [
  'enums.ts',
  'types.ts',
  'domain/user.ts',
  'domain/candidate.ts',
  'domain/source.ts',
  'domain/opportunity.ts',
  'domain/opportunityVersion.ts',
  'domain/skill.ts',
  'domain/eligibility.ts',
  'domain/duplicate.ts',
  'domain/news.ts',
  'domain/event.ts',
  'domain/certification.ts',
  'domain/fellowship.ts',
  'domain/notification.ts',
  'domain/application.ts',
  'domain/configuration.ts',
  'domain/benchmark.ts',
  'domain/validation.ts',
];

let ok = true;
files.forEach(f => {
  const p = path.join(base, f);
  if (!fs.existsSync(p)) {
    console.error('MISSING', f);
    ok = false;
  } else {
    console.log('FOUND', f);
  }
});

if (ok) {
  console.log('DOMAIN MODEL FILES PRESENT');
  process.exit(0);
} else {
  process.exit(1);
}
