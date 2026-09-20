import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildProfile, stalePaths } from '../scripts/lib/profile.mjs';

const fixture = fileURLToPath(new URL('../tests/fixtures/tailwind-shadcn/', import.meta.url));
const cli = fileURLToPath(new URL('../scripts/check-profile.mjs', import.meta.url));

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'ux-engine-'));
  cpSync(fixture, dir, { recursive: true });
  return dir;
}

function run(root) {
  try {
    execFileSync(process.execPath, [cli, root], { encoding: 'utf8' });
    return 0;
  } catch (e) {
    return e.status;
  }
}

test('stalePaths returns nothing for an untouched repo', () => {
  const dir = scratch();
  assert.deepEqual(stalePaths(dir, buildProfile(dir)), []);
});

test('stalePaths names the file that changed', () => {
  const dir = scratch();
  const profile = buildProfile(dir);
  writeFileSync(join(dir, 'src/styles/app.css'), '@theme { --color-primary: red; }');
  assert.deepEqual(stalePaths(dir, profile), ['src/styles/app.css']);
});

test('stalePaths reports a deleted source file', () => {
  const dir = scratch();
  const profile = buildProfile(dir);
  profile.derivedFrom.push({ path: 'gone.css', sha256: 'x'.repeat(64) });
  assert.ok(stalePaths(dir, profile).includes('gone.css'));
});

test('CLI exits 3 when no profile exists', () => {
  assert.equal(run(scratch()), 3);
});

test('CLI exits 0 for a fresh profile', () => {
  const dir = scratch();
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify(buildProfile(dir), null, 2));
  assert.equal(run(dir), 0);
});

test('CLI exits 2 for a stale profile', () => {
  const dir = scratch();
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify(buildProfile(dir), null, 2));
  writeFileSync(join(dir, 'src/styles/app.css'), '@theme { --color-primary: red; }');
  assert.equal(run(dir), 2);
});

test('CLI exits 4 for a newer schema version', () => {
  const dir = scratch();
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  const profile = buildProfile(dir);
  profile.version = 99;
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify(profile, null, 2));
  assert.equal(run(dir), 4);
});
