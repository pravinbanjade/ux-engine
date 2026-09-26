#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadModes, indexLine, sectionBodies } from './lib/library.mjs';
import { selectModes, unknownKinds } from './lib/select.mjs';

const USAGE = `Usage: select-modes.mjs [--kinds a,b] [--category a,b] [--severity a,b] [--exclude-detection a,b] [--signals]

Prints the failure modes that could apply to the named surfaces, one INDEX.md
line each. Omitting --kinds lists the whole catalog. --signals adds each
mode's file path and its Signal section, so candidates can be screened
without opening a file per mode.

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

let signals = false;
for (let i = 0; i < args.length; i += 2) {
  if (args[i] === '--signals') {
    signals = true;
    i -= 1;
    continue;
  }
  const key = FLAGS[args[i]];
  if (!key || args[i + 1] === undefined) fail(USAGE, 1);
  opts[key] = list(args[i + 1]);
}

const bad = unknownKinds(opts.kinds ?? []);
if (bad.length) {
  fail(`${bad.join(', ')} — not a known surface kind. See APPLIES_TO in scripts/lib/library.mjs.`, 2);
}

const dir = join(fileURLToPath(new URL('../', import.meta.url)), 'skills/failure-modes/references');
const selected = selectModes(loadModes(dir), opts);

// A broad surface list selects most of the catalog — a folder holding a
// dashboard, a form and a table is a candidate for ~100 modes — and an audit
// that opens each file to rule it out spends a tool call and a full page of
// context per mode, most of them to learn the mode does not apply. The
// Signal is what rules a mode in or out, so print it here, in one call, and
// leave the full file for the modes whose Signal the code actually shows.
const render = signals
  ? (m) => [
    indexLine(m.data),
    `  file: ${join(dir, m.filename)}`,
    `  signal: ${(sectionBodies(m.body)['## Signal'] ?? '').replace(/\s+/g, ' ').trim()}`,
  ].join('\n')
  : (m) => indexLine(m.data);
const out = selected.map(render);
if (out.length) console.log(out.join(signals ? '\n\n' : '\n'));
