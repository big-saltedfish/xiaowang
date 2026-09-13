import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const root = 'research-skill';
const files = {};
function visit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '__pycache__') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (/\.(md|py)$/.test(entry.name)) files[relative(root, path)] = readFileSync(path);
  }
}
visit(root);
writeFileSync('public/watchtower-research.zip', zipSync(files));
console.log(`Packaged ${Object.keys(files).length} research skill files`);
