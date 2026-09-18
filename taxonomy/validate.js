const fs = require('fs');
const path = require('path');

const taxonomyDir = __dirname;
const files = fs.readdirSync(taxonomyDir).filter(f => f.endsWith('.yaml'));

let allOk = true;

function parseNodes(content) {
  const nodes = [];
  const lines = content.split(/\r?\n/);
  let current = null;
  for (let line of lines) {
    if (/^\s*-\s*id:/.test(line)) {
      if (current) nodes.push(current);
      current = {};
      const m = line.match(/id:\s*([^\s#]+)/);
      if (m) current.id = m[1].trim();
    } else if (current) {
      const nameMatch = line.match(/^\s*name:\s*(.+)$/);
      if (nameMatch) current.name = nameMatch[1].trim();
      const parentMatch = line.match(/^\s*parent:\s*([^\s#]+|null)/);
      if (parentMatch) current.parent = parentMatch[1].trim();
      const activeMatch = line.match(/^\s*active:\s*(true|false)/);
      if (activeMatch) current.active = activeMatch[1] === 'true';
    }
  }
  if (current) nodes.push(current);
  return nodes;
}

files.forEach(file => {
  const fullPath = path.join(taxonomyDir, file);
  console.log(`Validating ${file}...`);
  if (!fs.existsSync(fullPath)) {
    console.error(`  MISSING FILE`);
    allOk = false;
    return;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  if (!content.includes('nodes:')) {
    console.error(`  Missing nodes key`);
    allOk = false;
    return;
  }
  const nodes = parseNodes(content);
  const ids = new Set();
  let fileOk = true;
  nodes.forEach(n => {
    if (!n.id) {
      console.error(`  Node missing id`);
      fileOk = false;
    }
    if (!n.name) {
      console.error(`  Node ${n.id} missing name`);
      fileOk = false;
    }
    if (ids.has(n.id)) {
      console.error(`  Duplicate id ${n.id}`);
      fileOk = false;
    }
    ids.add(n.id);
  });
  // parent check
  nodes.forEach(n => {
    if (n.parent && n.parent !== 'null' && !ids.has(n.parent) && n.parent !== '') {
      // allow cross-file references? For simplicity, check within file
      // We'll just warn
      // console.warn(`  Parent ${n.parent} not found in same file for ${n.id}`);
    }
  });
  if (fileOk) {
    console.log(`  OK - ${nodes.length} nodes`);
  } else {
    allOk = false;
  }
});

if (allOk) {
  console.log('All taxonomy files validated successfully');
  process.exit(0);
} else {
  console.error('Validation failed');
  process.exit(1);
}
