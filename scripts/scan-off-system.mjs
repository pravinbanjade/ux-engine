#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scanRepo, DEFAULT_THRESHOLDS } from './lib/scanner.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const profilePath = flag('profile');
if (!profilePath) {
  console.error('Usage: scan-off-system.mjs --profile <path> [--root <dir>] [--path <dir>] [--threshold-color N] [--threshold-scalar N]');
  process.exit(1);
}

const root = resolve(flag('root', '.'));
const profile = JSON.parse(readFileSync(resolve(profilePath), 'utf8'));
const thresholds = {
  color: Number(flag('threshold-color', DEFAULT_THRESHOLDS.color)),
  scalar: Number(flag('threshold-scalar', DEFAULT_THRESHOLDS.scalar)),
};

const result = scanRepo(root, profile, { path: flag('path', null), thresholds });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
