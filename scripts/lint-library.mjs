#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadModes, validateModeFile, checkIndex } from './lib/library.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = join(root, 'skills/failure-modes/references');
const indexPath = join(dir, 'INDEX.md');

const modes = loadModes(dir);
const errors = modes.flatMap((m) => validateModeFile(m));

const seen = new Set();
for (const { data, filename } of modes) {
  if (seen.has(data.id)) errors.push(`${filename}: duplicate id ${data.id}`);
  seen.add(data.id);
}

errors.push(...checkIndex(modes, existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : ''));

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem(s) across ${modes.length} mode file(s).`);
  process.exit(1);
}
console.log(`OK — ${modes.length} mode file(s), index in sync.`);
