import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../scripts/detect-profile.mjs', import.meta.url));

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'ux-engine-detect-'));
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'scratch', private: true, dependencies: { react: '^18.0.0' } }, null, 2),
  );
  mkdirSync(join(dir, 'src/styles'), { recursive: true });
  writeFileSync(
    join(dir, 'src/styles/app.css'),
    ':root {\n  --color-primary: #111111;\n  --color-secondary: #222222;\n  --spacing-1: 4px;\n}\n',
  );
  mkdirSync(join(dir, 'src/components/ui'), { recursive: true });
  writeFileSync(join(dir, 'src/components/ui/Button.jsx'), 'export const Button = () => null;\n');
  return dir;
}

// spawnSync (not execFileSync) so a successful run's stderr is still captured — that's
// where every ignored/rejected-override warning is printed, and detect-profile.mjs
// always exits 0.
function run(dir) {
  const result = spawnSync(process.execPath, [cli, dir], { encoding: 'utf8' });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status };
}

function readProfile(dir) {
  return JSON.parse(readFileSync(join(dir, '.ux-engine/profile.json'), 'utf8'));
}

test('a fresh run writes no resolvedByHuman', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const { status } = run(dir);
  const profile = readProfile(dir);

  assert.equal(status, 0);
  assert.equal(profile.resolvedByHuman, undefined);
  assert.equal(profile.components.variantMechanism, 'props');
  assert.equal(profile.confidence.components, 'medium'); // dir found, no library — not a human answer yet
});

test('a hand-answered field survives re-detection, and a genuinely changed source still refreshes', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  run(dir);
  const first = readProfile(dir);

  // Simulate a human answering the low/medium-confidence question with something the
  // detector could never produce on its own, and recording that it was answered.
  first.components.variantMechanism = 'hand-answered-mechanism';
  first.resolvedByHuman = ['components.variantMechanism'];
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify(first, null, 2));

  // Change a genuinely-detected source between runs: a new token in the watched stylesheet.
  writeFileSync(
    join(dir, 'src/styles/app.css'),
    ':root {\n  --color-primary: #111111;\n  --color-secondary: #222222;\n  --spacing-1: 4px;\n  --color-accent: #333333;\n}\n',
  );

  const { stdout, status } = run(dir);
  const second = readProfile(dir);

  assert.equal(status, 0);
  assert.deepEqual(second.resolvedByHuman, ['components.variantMechanism']);
  assert.equal(second.components.variantMechanism, 'hand-answered-mechanism');
  assert.equal(second.confidence.components, 'high');
  assert.match(stdout, /Carried forward human answers: components\.variantMechanism/);
  // The genuinely changed source still refreshed — the new token shows up.
  assert.equal(second.tokens.color['--color-accent'], '#333333');
});

test('an existing profile that is not valid JSON is ignored, not fatal', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  writeFileSync(join(dir, '.ux-engine/profile.json'), '{ not valid json');

  const { status } = run(dir);
  assert.equal(status, 0);
  const profile = readProfile(dir);
  assert.equal(profile.version, 1);
  assert.equal(profile.resolvedByHuman, undefined);
});

test('an existing profile with an invalid structure is ignored, not fatal', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  // Missing derivedFrom entirely — structurally invalid per isValidProfileShape.
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify({ version: 1, resolvedByHuman: ['components.dir'] }));

  const { status } = run(dir);
  assert.equal(status, 0);
  const profile = readProfile(dir);
  assert.equal(profile.version, 1);
  assert.ok(Array.isArray(profile.derivedFrom));
  // The invalid file's resolvedByHuman must not have been trusted.
  assert.equal(profile.resolvedByHuman, undefined);
  assert.equal(profile.components.dir, 'src/components/ui');
});

test('a crafted resolvedByHuman aimed at __proto__ is rejected, reported, and never pollutes', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  // The exact shape a hostile pull request could commit: __proto__ here is just an own
  // JSON property named "__proto__" (JSON.parse never creates a real prototype link),
  // but resolvedByHuman naming it is what would have driven the old setPath into
  // Object.prototype via the real accessor.
  writeFileSync(
    join(dir, '.ux-engine/profile.json'),
    JSON.stringify({
      version: 1,
      derivedFrom: [],
      resolvedByHuman: ['__proto__.pwned'],
      __proto__: { pwned: 'yes' },
    }),
  );

  const { stdout, stderr, status } = run(dir);

  assert.equal(status, 0);
  assert.match(stderr, /ignoring resolvedByHuman entry outside the allowed field list: __proto__\.pwned/);
  assert.doesNotMatch(stdout, /Carried forward human answers/);
  const profile = readProfile(dir);
  assert.equal(profile.resolvedByHuman, undefined);
  // The real test: this process's Object.prototype must be completely clean.
  assert.equal(({}).pwned, undefined);
  assert.equal(Object.prototype.pwned, undefined);
});

test('a resolvedByHuman naming derivedFrom is rejected and the real hash is recomputed', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  run(dir);
  const first = readProfile(dir);
  const realEntry = first.derivedFrom.find((e) => e.path === 'package.json');
  assert.ok(realEntry, 'package.json should be in derivedFrom');

  // Forge the hash and try to pin it via resolvedByHuman so stalePaths would never
  // notice package.json changing again.
  first.derivedFrom = first.derivedFrom.map((e) =>
    e.path === 'package.json' ? { path: e.path, sha256: 'f'.repeat(64) } : e,
  );
  first.resolvedByHuman = ['derivedFrom.0.sha256'];
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify(first, null, 2));

  const { stderr, status } = run(dir);

  assert.equal(status, 0);
  assert.match(stderr, /ignoring resolvedByHuman entry outside the allowed field list: derivedFrom\.0\.sha256/);
  const second = readProfile(dir);
  const recomputed = second.derivedFrom.find((e) => e.path === 'package.json');
  assert.equal(recomputed.sha256, realEntry.sha256);
  assert.notEqual(recomputed.sha256, 'f'.repeat(64));
});

test('a styling.tokenSource override that is a string instead of an array is ignored with a warning', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  run(dir);
  const first = readProfile(dir);
  first.styling.tokenSource = 'src/styles/app.css'; // a string, not an array — a bad hand edit
  first.resolvedByHuman = ['styling.tokenSource'];
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify(first, null, 2));

  const { stderr, status } = run(dir);

  assert.equal(status, 0); // no crash from iterating the string's characters as filenames
  assert.match(stderr, /ignoring styling\.tokenSource override.*expected an array of strings/);
  const second = readProfile(dir);
  assert.deepEqual(second.styling.tokenSource, ['src/styles/app.css']); // falls back to detection
  assert.equal(second.tokens.color['--color-primary'], '#111111');
});
