#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateProfile } from './lib/profile.mjs';
import { validateIntent, validateWireframe } from './lib/wireframe.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const USAGE = 'Usage: check-wireframe.mjs --wireframe <path> --profile <path> [--root <dir>] [--intent-only]';

const wireframePath = flag('wireframe');
const profilePath = flag('profile');
if (!wireframePath || !profilePath) {
  console.error(USAGE);
  process.exit(1);
}

// Profile first, and with the same words every other command uses: a broken
// profile is not a broken wireframe, and the remedy is different.
let profile;
try {
  profile = JSON.parse(readFileSync(resolve(profilePath), 'utf8'));
} catch {
  console.error('No usable profile at that path. Run /ux-design-system first.');
  process.exit(3);
}
const defect = validateProfile(profile);
if (defect) {
  console.error(`${defect} Run /ux-design-system first.`);
  process.exit(3);
}

let wireframe;
try {
  wireframe = JSON.parse(readFileSync(resolve(wireframePath), 'utf8'));
} catch {
  console.error('Could not read --wireframe JSON.');
  process.exit(2);
}

const rootFlag = flag('root');
const intentOnly = has('intent-only');
const errors = intentOnly
  ? validateIntent(wireframe?.intent)
  : validateWireframe(wireframe, profile, rootFlag ? { root: resolve(rootFlag) } : {});

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(2);
}

console.log(intentOnly ? 'Intent is complete.' : 'Wireframe is valid.');
