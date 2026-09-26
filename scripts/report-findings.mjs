#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProfile, sha256 } from './lib/profile.mjs';
import { extractExceptions } from './lib/design-doc.mjs';
import { parseExceptions, matchesException } from './lib/exceptions.mjs';
import { changedRanges, inScope } from './lib/diff.mjs';
import { modeIndex } from './lib/library.mjs';
import {
  normalizeScannerFindings, validateModelFindings, mergeFindings,
  rankFindings, buildEnvelope, renderReport,
} from './lib/findings.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const USAGE = 'Usage: report-findings.mjs --scanner <json> [--model <json>] --profile <path> [--design <path>] [--root <dir>] [--scope path|diff] [--path <dir>] [--base <ref>] [--fail-on high|medium|low] [--out <path>] [--report <path>] [--json]';

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const scannerPath = flag('scanner');
const profilePath = flag('profile');
if (!scannerPath || !profilePath) fail(USAGE);

const scope = flag('scope', 'path');
if (!['path', 'diff'].includes(scope)) fail(`${USAGE}\n--scope must be "path" or "diff".`);
if (scope === 'diff' && has('path')) fail('--path applies to --scope path, not --scope diff.');
if (scope === 'path' && has('base')) fail('--base applies to --scope diff, not --scope path.');

const failOn = flag('fail-on', null);
if (failOn && !['high', 'medium', 'low'].includes(failOn)) fail(`${USAGE}\n--fail-on must be high, medium or low.`);

const root = resolve(flag('root', '.'));
const designPath = resolve(flag('design', join(root, 'DESIGN.md')));
const outPath = resolve(flag('out', join(root, '.ux-engine/findings.json')));
// The rendered report, kept beside the envelope. A report of sixty findings
// is too long to paste into a conversation, and the model presenting it will
// condense it whether or not it is told to — so the full text always exists
// on disk, and what is shown can be an excerpt of it that points here.
const reportPath = resolve(flag('report', join(dirname(outPath), 'report.md')));

// A profile that cannot be trusted must never produce a report: same
// vocabulary and same exit code as every other command in the plugin.
let profileText;
try {
  profileText = readFileSync(resolve(profilePath), 'utf8');
} catch {
  console.error('No profile at that path. Run /ux-design-system first.');
  process.exit(3);
}
let profile;
try {
  profile = JSON.parse(profileText);
} catch {
  console.error('Profile file is not valid JSON. Run /ux-design-system first.');
  process.exit(3);
}
const defect = validateProfile(profile);
if (defect) {
  console.error(`${defect} Run /ux-design-system first.`);
  process.exit(3);
}

let scanOutput;
try {
  scanOutput = JSON.parse(readFileSync(resolve(scannerPath), 'utf8'));
} catch {
  fail(`${USAGE}\nCould not read --scanner JSON.`);
}

const modes = modeIndex(fileURLToPath(new URL('../skills/failure-modes/references/', import.meta.url)));

const scannerFindings = normalizeScannerFindings(scanOutput, modes);

let modelFindings = [];
const modelPath = flag('model');
if (modelPath) {
  let rows;
  try {
    rows = JSON.parse(readFileSync(resolve(modelPath), 'utf8'));
  } catch {
    fail(`${USAGE}\nCould not read --model JSON.`);
  }
  const { findings, errors } = validateModelFindings(rows, modes);
  if (errors.length) {
    console.error('Model findings failed validation:');
    for (const error of errors) console.error(`  ${error}`);
    process.exit(4);
  }
  modelFindings = findings;
}

// Exceptions are advisory input written by a human; a typo in them is
// reported on stderr and the run continues, because a malformed line
// disables nothing and stopping the audit would be the larger harm.
let entries = [];
if (existsSync(designPath)) {
  const doc = readFileSync(designPath, 'utf8');
  const body = extractExceptions(doc);
  const parsed = parseExceptions(body);
  entries = parsed.entries;
  // parseExceptions numbers lines within the section body it was handed.
  // The warning names DESIGN.md, so translate to a line number in that
  // file — a human told "line 1" would open the file and find its title.
  const at = doc.indexOf(body);
  const offset = at === -1 ? 0 : doc.slice(0, at).split('\n').length - 1;
  for (const warning of parsed.warnings) {
    console.error(`DESIGN.md exceptions: ${warning.replace(/^line (\d+)/, (_, n) => `line ${Number(n) + offset}`)}`);
  }
}

let findings = mergeFindings(scannerFindings, modelFindings);

let exceptionsApplied = 0;
if (entries.length) {
  findings = findings.filter((finding) => {
    if (!matchesException(finding, entries)) return true;
    exceptionsApplied += 1;
    return false;
  });
}

let scopeValue = flag('path', '.');
if (scope === 'diff') {
  scopeValue = flag('base', 'HEAD');
  const changed = changedRanges({ base: scopeValue, cwd: root });
  findings = findings.filter((finding) => inScope(finding, changed));
}

const envelope = buildEnvelope({
  findings: rankFindings(findings),
  skipped: scanOutput.skipped ?? [],
  suppressed: scanOutput.suppressed ?? [],
  profileHash: sha256(profileText),
  scope: { kind: scope, value: scopeValue },
  exceptionsApplied,
  scannedPackage: scanOutput.scannedPackage ?? null,
});

const rendered = `${renderReport(envelope, modes)}\n`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(envelope, null, 2)}\n`);
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, rendered);

process.stdout.write(has('json') ? `${JSON.stringify(envelope, null, 2)}\n` : rendered);

if (failOn) {
  const rank = { high: 0, medium: 1, low: 2 };
  if (envelope.findings.some((finding) => rank[finding.severity] <= rank[failOn])) process.exit(2);
}
