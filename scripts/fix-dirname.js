const fs = require('fs');
const path = 'C:\\Users\\HP\\Desktop\\PeterWorkspace\\AutomatedOpportunityWorkflow\\shared\\src\\config\\loader.ts';
let c = fs.readFileSync(path,'utf8');
c = c.replace("import fs from 'fs';","import fs from 'fs';\nimport { fileURLToPath } from 'url';");
c = c.replace("const configDir = path.resolve(__dirname, '../../config');","const __filename=fileURLToPath(import.meta.url);\n  const __dirname=path.dirname(__filename);\n  const configDir = path.resolve(__dirname, '../../config');");
fs.writeFileSync(path,c);
console.log('done');
