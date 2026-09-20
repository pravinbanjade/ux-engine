import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

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

function run(dir) {
  return execFileSync(process.execPath, [cli, dir], { encoding: 'utf8' });
}

function readProfile(dir) {
  return JSON.parse(readFileSync(join(dir, '.ux-engine/profile.json'), 'utf8'));
}

test('a fresh run writes no resolvedByHuman', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  run(dir);
  const profile = readProfile(dir);

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

  const stdout = run(dir);
  const second = readProfile(dir);

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

  assert.doesNotThrow(() => run(dir));
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

  assert.doesNotThrow(() => run(dir));
  const profile = readProfile(dir);
  assert.equal(profile.version, 1);
  assert.ok(Array.isArray(profile.derivedFrom));
  // The invalid file's resolvedByHuman must not have been trusted.
  assert.equal(profile.resolvedByHuman, undefined);
  assert.equal(profile.components.dir, 'src/components/ui');
});
