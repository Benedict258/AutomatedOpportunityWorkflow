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
      // Replace any number of ../ followed by shared/src/
      content = content.replace(/(?:\.\.\/)+shared\/src\//g, 'shared/');
      // Also replace any remaining ../shared/
      content = content.replace(/(?:\.\.\/)+shared\//g, 'shared/');
      if (content !== original) {
        fs.writeFileSync(full, content, 'utf8');
        console.log('Updated:', full);
      }
    }
  }
}

walk(root);
console.log('Done');