import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, readFileSync, rmSync } from 'node:fs';
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
    const stdout = execFileSync(process.execPath, [cli, root], { encoding: 'utf8' });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    return { status: e.status, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

test('stalePaths returns nothing for an untouched repo', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.deepEqual(stalePaths(dir, buildProfile(dir)), []);
});

test('stalePaths names the file that changed', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const profile = buildProfile(dir);
  writeFileSync(join(dir, 'src/styles/app.css'), '@theme { --color-primary: red; }');
  assert.deepEqual(stalePaths(dir, profile), ['src/styles/app.css']);
});

test('stalePaths reports a deleted source file', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const profile = buildProfile(dir);
  profile.derivedFrom.push({ path: 'gone.css', sha256: 'x'.repeat(64) });
  assert.ok(stalePaths(dir, profile).includes('gone.css'));
});

test('CLI exits 3 when no profile exists', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const result = run(dir);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /No \.ux-engine\/profile\.json/);
});

test('CLI exits 0 for a fresh profile', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify(buildProfile(dir), null, 2));
  const result = run(dir);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Profile is current/);
});

test('CLI exits 2 for a stale profile', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify(buildProfile(dir), null, 2));
  writeFileSync(join(dir, 'src/styles/app.css'), '@theme { --color-primary: red; }');
  const result = run(dir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Profile is stale/);
});

test('CLI exits 4 for a newer schema version', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  const profile = buildProfile(dir);
  profile.version = 99;
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify(profile, null, 2));
  const result = run(dir);
  assert.equal(result.status, 4);
  assert.match(result.stderr, /newer than this plugin/);
});

test('CLI exits 3 for invalid JSON', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  writeFileSync(join(dir, '.ux-engine/profile.json'), '{ "version": 1,');
  const result = run(dir);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /not valid JSON/);
});

test('CLI exits 3 for non-object profile', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  writeFileSync(join(dir, '.ux-engine/profile.json'), '[]');
  const result = run(dir);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /not a JSON object/);
});

test('CLI exits 3 for missing version field', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify({ derivedFrom: [] }, null, 2));
  const result = run(dir);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /invalid "version"/);
});

test('CLI exits 3 for invalid version type', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify({ version: "1", derivedFrom: [] }, null, 2));
  const result = run(dir);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /invalid "version"/);
});

test('CLI exits 3 for missing derivedFrom field', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify({ version: 1 }, null, 2));
  const result = run(dir);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /invalid "derivedFrom"/);
});

test('CLI exits 3 for non-array derivedFrom', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify({ version: 1, derivedFrom: {} }, null, 2));
  const result = run(dir);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /invalid "derivedFrom"/);
});

test('CLI exits 3 for invalid derivedFrom entry structure', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify({ version: 1, derivedFrom: [{}] }, null, 2));
  const result = run(dir);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /invalid "path"/);
});

test('CLI exits 3 for missing sha256 in derivedFrom entry', (t) => {
  const dir = scratch();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  writeFileSync(join(dir, '.ux-engine/profile.json'), JSON.stringify({ version: 1, derivedFrom: [{ path: "file.css" }] }, null, 2));
  const result = run(dir);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /invalid "sha256"/);
});
