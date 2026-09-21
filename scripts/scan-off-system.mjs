#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scanRepo, DEFAULT_THRESHOLDS } from './lib/scanner.mjs';
import { validateProfile } from './lib/profile.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const USAGE = 'Usage: scan-off-system.mjs --profile <path> [--root <dir>] [--path <dir>] [--threshold-color N] [--threshold-scalar N]';

const profilePath = flag('profile');
if (!profilePath) {
  console.error(USAGE);
  process.exit(1);
}

const root = resolve(flag('root', '.'));

let profile;
try {
  profile = JSON.parse(readFileSync(resolve(profilePath), 'utf8'));
} catch {
  // A missing or unreadable --profile path is a usage error, not a crash —
  // give it the same clean message as the missing-flag case above instead
  // of letting a raw ENOENT/SyntaxError stack trace hit stderr. Exiting
  // here, before anything is written to stdout, keeps stdout empty on this
  // path so a caller piping stdout as JSON is never handed a stack trace or
  // a truncated document.
  console.error(USAGE);
  process.exit(1);
}

// Unlike the checks above (usage errors, exit 1), a profile that parses as
// JSON but isn't a complete, usable profile is a different kind of failure
// — the same one write-design-doc.mjs and check-profile.mjs report — so it
// gets that vocabulary and exit code instead: a clear message on stderr,
// exit 3, and stdout left empty rather than throwing mid-scan.
const defect = validateProfile(profile);
if (defect) {
  console.error(`${defect} Run /ux-design-system first.`);
  process.exit(3);
}

const thresholds = {
  color: Number(flag('threshold-color', DEFAULT_THRESHOLDS.color)),
  scalar: Number(flag('threshold-scalar', DEFAULT_THRESHOLDS.scalar)),
};

const result = scanRepo(root, profile, { path: flag('path', null), thresholds });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
