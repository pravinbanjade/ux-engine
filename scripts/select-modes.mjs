#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadModes, indexLine } from './lib/library.mjs';
import { selectModes, unknownKinds } from './lib/select.mjs';

const USAGE = `Usage: select-modes.mjs [--kinds a,b] [--category a,b] [--severity a,b] [--exclude-detection a,b]

Prints the failure modes that could apply to the named surfaces, one INDEX.md
line each. Omitting --kinds lists the whole catalog.

Exit: 0 success (including no matches) · 1 usage · 2 unknown surface kind`;

const fail = (message, code) => {
  console.error(message);
  process.exit(code);
};

const list = (value) => value.split(',').map((s) => s.trim()).filter(Boolean);

const args = process.argv.slice(2);
const opts = {};
const FLAGS = {
  '--kinds': 'kinds',
  '--category': 'categories',
  '--severity': 'severities',
  '--exclude-detection': 'excludeDetections',
};

for (let i = 0; i < args.length; i += 2) {
  const key = FLAGS[args[i]];
  if (!key || args[i + 1] === undefined) fail(USAGE, 1);
  opts[key] = list(args[i + 1]);
}

const bad = unknownKinds(opts.kinds ?? []);
if (bad.length) {
  fail(`${bad.join(', ')} — not a known surface kind. See APPLIES_TO in scripts/lib/library.mjs.`, 2);
}

const dir = join(fileURLToPath(new URL('../', import.meta.url)), 'skills/failure-modes/references');
const lines = selectModes(loadModes(dir), opts).map((m) => indexLine(m.data));
if (lines.length) console.log(lines.join('\n'));
