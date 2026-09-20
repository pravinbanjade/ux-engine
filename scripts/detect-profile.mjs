#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { buildProfile, isValidProfileShape } from './lib/profile.mjs';

const args = process.argv.slice(2);
const root = resolve(args.find((a) => !a.startsWith('--')) ?? '.');
const outFlag = args.indexOf('--out');
const out = outFlag === -1 ? join(root, '.ux-engine/profile.json') : resolve(args[outFlag + 1]);

function readExistingProfile(path) {
  if (!existsSync(path)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
  return isValidProfileShape(parsed) ? parsed : null;
}

function getPath(obj, path) {
  return path.split('.').reduce((cur, key) => (cur == null ? undefined : cur[key]), obj);
}

// Re-detection must not clobber a field a human already answered. If a
// usable profile is already on disk, re-derive an `overrides` map from
// whatever it recorded in `resolvedByHuman`, using that profile's own
// current values — never guessing, never asking again. An unreadable or
// structurally invalid existing profile is treated exactly like no profile
// at all: detect fresh rather than fail.
const existing = readExistingProfile(out);
const candidatePaths = Array.isArray(existing?.resolvedByHuman)
  ? existing.resolvedByHuman.filter((p) => typeof p === 'string')
  : [];

const overrides = {};
const resolvedByHuman = [];
for (const path of candidatePaths) {
  const value = getPath(existing, path);
  if (value !== undefined) {
    overrides[path] = value;
    resolvedByHuman.push(path);
  }
}

const profile = buildProfile(root, { overrides });
if (resolvedByHuman.length) profile.resolvedByHuman = resolvedByHuman;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(profile, null, 2)}\n`);

const low = Object.entries(profile.confidence).filter(([, v]) => v === 'low').map(([k]) => k);
console.log(`Wrote ${out}`);
console.log(`styling=${profile.styling.system ?? 'unknown'} components=${profile.components.dir ?? 'unknown'}`);
if (resolvedByHuman.length) console.log(`Carried forward human answers: ${resolvedByHuman.join(', ')}`);
if (low.length) console.log(`LOW CONFIDENCE: ${low.join(', ')} — ask the user and write the answers back.`);
