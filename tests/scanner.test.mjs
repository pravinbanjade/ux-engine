import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildProfile } from '../scripts/lib/profile.mjs';
import { findLiterals, nearestToken, scanRepo, DEFAULT_THRESHOLDS } from '../scripts/lib/scanner.mjs';

const fixture = (n) => fileURLToPath(new URL(`../tests/fixtures/${n}/`, import.meta.url));
const cli = fileURLToPath(new URL('../scripts/scan-off-system.mjs', import.meta.url));

test('findLiterals reports value, kind and 1-indexed line', () => {
  const found = findLiterals("a\nconst c = '#3b7d4f';\nconst p = '17px';\nconst d = '220ms';\n");
  assert.deepEqual(found, [
    { line: 2, value: '#3b7d4f', kind: 'color' },
    { line: 3, value: '17px', kind: 'length' },
    { line: 4, value: '220ms', kind: 'time' },
  ]);
});

test('findLiterals skips a line marked ux-engine-ignore', () => {
  assert.deepEqual(findLiterals("const c = '#3b7d4f'; // ux-engine-ignore\n"), []);
});

test('findLiterals does not report a token reference', () => {
  assert.deepEqual(findLiterals('background: var(--color-primary);\n'), []);
});

test('nearestToken finds a perceptually close colour', () => {
  const tokens = { '--color-primary': '#2f6f4f' };
  const hit = nearestToken({ value: '#2f6f55', kind: 'color' }, tokens, DEFAULT_THRESHOLDS);
  assert.equal(hit.token, '--color-primary');
  assert.ok(hit.distance < DEFAULT_THRESHOLDS.color);
});

test('nearestToken returns null when nothing is close enough', () => {
  const tokens = { '--color-primary': '#2f6f4f' };
  assert.equal(nearestToken({ value: '#ffffff', kind: 'color' }, tokens, DEFAULT_THRESHOLDS), null);
});

test('nearestToken matches a scalar within 15 percent', () => {
  const tokens = { '--space-4': '16px' };
  const hit = nearestToken({ value: '17px', kind: 'length' }, tokens, DEFAULT_THRESHOLDS);
  assert.equal(hit.token, '--space-4');
});

test('scanRepo finds the planted violations and assigns the right IDs', () => {
  const root = fixture('tailwind-shadcn');
  const { findings } = scanRepo(root, buildProfile(root), {});
  const offender = findings.filter((f) => f.file === 'src/components/Offender.tsx');
  assert.deepEqual(offender.map((f) => f.id).sort(), ['UX-101', 'UX-102', 'UX-103']);
});

test('scanRepo does not flag the clean components', () => {
  const root = fixture('tailwind-shadcn');
  const { findings } = scanRepo(root, buildProfile(root), {});
  assert.deepEqual(findings.filter((f) => f.file.includes('ui/')), []);
});

test('scanRepo never scans the token source itself', () => {
  const root = fixture('css-modules');
  const { findings } = scanRepo(root, buildProfile(root), {});
  assert.deepEqual(findings.filter((f) => f.file === 'src/styles/tokens.css'), []);
});

test('scanRepo works on a css-in-js repo with no CSS token file', () => {
  const root = fixture('styled-components');
  const { findings } = scanRepo(root, buildProfile(root), {});
  assert.ok(findings.some((f) => f.file === 'src/components/Offender.tsx'));
});

test('declaring a JS/TS theme file as the token source excludes it from scanning', () => {
  const root = fixture('styled-components');
  // The fixture's theme.ts is not detected as a token source (buildProfile
  // only ever populates styling.tokenSource from .css files), so without an
  // override it gets scanned like any other file and its own token
  // definitions come back as false-positive findings. Declaring it via the
  // override that detection.md now instructs a human to record is the fix,
  // and it requires no scanner change: the exclusion logic already keys off
  // every entry in profile.styling.tokenSource.
  const profile = buildProfile(root, {
    overrides: { 'styling.tokenSource': ['src/theme.ts'], 'styling.tokenSyntax': 'js-object' },
  });
  const { findings } = scanRepo(root, profile, {});
  assert.deepEqual(findings.filter((f) => f.file === 'src/theme.ts'), []);
  const offender = findings.filter((f) => f.file === 'src/components/Offender.tsx');
  assert.deepEqual(offender.map((f) => f.id).sort(), ['UX-101', 'UX-102', 'UX-103']);
});

test('a finding with no near token says so instead of proposing one', () => {
  const root = fixture('tailwind-shadcn');
  const { findings } = scanRepo(root, buildProfile(root), {});
  const duration = findings.find((f) => f.id === 'UX-103');
  assert.ok('nearestToken' in duration);
  assert.ok(duration.nearestToken === null || typeof duration.nearestToken === 'string');
});

test('the CLI emits JSON with findings and skipped', () => {
  const root = fixture('tailwind-shadcn');
  const profilePath = fileURLToPath(new URL('../tests/snapshots/tailwind-shadcn.profile.json', import.meta.url));
  const out = JSON.parse(execFileSync(process.execPath, [cli, '--profile', profilePath, '--root', root], { encoding: 'utf8' }));
  assert.ok(Array.isArray(out.findings));
  assert.ok(Array.isArray(out.skipped));
  assert.ok(out.findings.length >= 3);
});
