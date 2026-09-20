import fs from 'fs';
import path from 'path';

const root = path.resolve('C:/Users/HP/Desktop/PeterWorkspace/AutomatedOpportunityWorkflow/backend');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      let content = fs.readFileSync(full, 'utf8');
      const original = content;
      // Replace various depths
      content = content.replace(/\.\.\/\.\.\/\.\.\/\.\.\/shared\/src\//g, 'shared/');
      content = content.replace(/\.\.\/\.\.\/\.\.\/shared\/src\//g, 'shared/');
      content = content.replace(/\.\.\/\.\.\/shared\/src\//g, 'shared/');
      content = content.replace(/\.\.\/shared\/src\//g, 'shared/');
      // Also replace imports that end with .../shared/src/... without trailing slash? but pattern above covers.
      if (content !== original) {
        fs.writeFileSync(full, content, 'utf8');
        console.log('Updated:', full);
      }
    }
  }
}

walk(root);
console.log('Done');