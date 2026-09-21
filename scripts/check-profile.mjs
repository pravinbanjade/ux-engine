#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stalePaths, validateProfile, SCHEMA_VERSION } from './lib/profile.mjs';

const root = resolve(process.argv[2] ?? '.');
const path = join(root, '.ux-engine/profile.json');

if (!existsSync(path)) {
  console.error('No .ux-engine/profile.json. Run /ux-design-system first.');
  process.exit(3);
}

let profile;
try {
  profile = JSON.parse(readFileSync(path, 'utf8'));
} catch (e) {
  console.error('Profile file is not valid JSON. Run /ux-design-system first.');
  process.exit(3);
}

if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
  console.error('Profile is not a JSON object. Run /ux-design-system first.');
  process.exit(3);
}

if (profile.version > SCHEMA_VERSION) {
  console.error(`Profile schema v${profile.version} is newer than this plugin (v${SCHEMA_VERSION}). Update ux-engine.`);
  process.exit(4);
}

const defect = validateProfile(profile);
if (defect) {
  console.error(`${defect} Run /ux-design-system first.`);
  process.exit(3);
}

const changed = stalePaths(root, profile);
if (changed.length) {
  console.error(`Profile is stale — these sources changed since it was generated:\n  ${changed.join('\n  ')}`);
  console.error('Re-run /ux-design-system to refresh it.');
  process.exit(2);
}

console.log('Profile is current.');
