const fs = require('fs');
const path = require('path');

const taxonomyDir = __dirname;

function loadFile(file) {
  const fullPath = path.join(taxonomyDir, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  return { file, content };
}

function loadAll() {
  const files = fs.readdirSync(taxonomyDir).filter(f => f.endsWith('.yaml'));
  const taxonomies = {};
  files.forEach(f => {
    taxonomies[f] = loadFile(f);
  });
  return taxonomies;
}

module.exports = { loadAll, loadFile };

// Simple CLI
if (require.main === module) {
  const data = loadAll();
  console.log('Loaded taxonomies:', Object.keys(data));
}
