#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderDesignDoc, extractExceptions, extractUnknownSections } from './lib/design-doc.mjs';
import { validateProfile } from './lib/profile.mjs';

const root = resolve(process.argv[2] ?? '.');
const path = join(root, 'DESIGN.md');
const profilePath = join(root, '.ux-engine/profile.json');

if (!existsSync(profilePath)) {
  console.error('No .ux-engine/profile.json. Run /ux-design-system first.');
  process.exit(3);
}

// Parsing and shape-validating before anything is written keeps stdout
// empty on every failure path here, so a caller piping this command's
// output is never handed a stack trace instead of JSON/markdown.
let profile;
try {
  profile = JSON.parse(readFileSync(profilePath, 'utf8'));
} catch {
  console.error('Profile file is not valid JSON. Run /ux-design-system first.');
  process.exit(3);
}

const defect = validateProfile(profile);
if (defect) {
  console.error(`${defect} Run /ux-design-system first.`);
  process.exit(3);
}

const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
const exceptions = extractExceptions(existing);
const unknownSections = extractUnknownSections(existing);

writeFileSync(path, renderDesignDoc(profile, exceptions, unknownSections));
console.log(`Wrote ${path}`);
