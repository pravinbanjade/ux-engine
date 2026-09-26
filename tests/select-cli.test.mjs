import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const cli = join(repoRoot, 'scripts/select-modes.mjs');
const run = (...args) => spawnSync('node', [cli, ...args], { encoding: 'utf8' });

test('--kinds returns matching modes, one index line each', () => {
  const result = run('--kinds', 'table,list');
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split('\n');
  assert.ok(lines.length > 0);
  for (const line of lines) {
    // Identical shape to INDEX.md: ID | category | severity | detection | title
    assert.match(line, /^UX-\d{3} \| [a-z-]+ \| (high|medium|low) \| (model|scanner|hybrid|conformance) \| .+$/);
  }
  assert.ok(result.stdout.includes('UX-046'), 'the empty-state mode applies to a list');
});

test('output is sorted by id', () => {
  const ids = run('--kinds', 'table,list,form').stdout.trim().split('\n').map((l) => l.split(' | ')[0]);
  assert.deepEqual(ids, [...ids].sort());
});

test('--category narrows to that category', () => {
  const out = run('--kinds', 'form,field', '--category', 'forms').stdout.trim().split('\n');
  for (const line of out) assert.equal(line.split(' | ')[1], 'forms');
});

test('--severity narrows to that severity', () => {
  const out = run('--kinds', 'table,list', '--severity', 'high').stdout.trim().split('\n');
  for (const line of out) assert.equal(line.split(' | ')[2], 'high');
});

test('--exclude-detection drops those modes', () => {
  // No --kinds, so every mode is a candidate and the exclusion is the only
  // thing keeping these two out. With a kinds filter the test would pass for
  // the wrong reason: UX-111 applies to generated-ui and would be absent anyway.
  const out = run('--exclude-detection', 'scanner,conformance').stdout;
  assert.ok(out.includes('UX-046'), 'a model mode should survive the exclusion');
  assert.ok(!out.includes('UX-101'), 'scanner mode should be excluded');
  assert.ok(!out.includes('UX-111'), 'conformance mode should be excluded');
});

test('zero matches still exits 0 with empty stdout', () => {
  const result = run('--kinds', 'avatar', '--category', 'conformance');
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '');
});

test('exits 2 on a kind outside the vocabulary', () => {
  // The whole reason APPLIES_TO is closed. Silently returning nothing would
  // let the caller conclude no mode applies when they simply mistyped.
  const result = run('--kinds', 'tables');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /tables/);
  assert.match(result.stderr, /not a known surface kind/i);
});

test('exits 1 on an unrecognised flag', () => {
  const result = run('--surface', 'table');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: select-modes\.mjs/);
});

test('exits 1 when a flag is given no value', () => {
  const result = run('--kinds');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: select-modes\.mjs/);
});

test('no flags at all lists the whole catalog', () => {
  const result = run();
  assert.equal(result.status, 0);
  assert.ok(result.stdout.trim().split('\n').length >= 25);
});

// An audit of a varied folder selects most of the catalog. Screening by
// Signal in one call is what keeps it from opening ~100 files to rule each
// one out.
test('--signals prints each candidate with its file and Signal', () => {
  const result = run('--kinds', 'list', '--signals');
  assert.equal(result.status, 0, result.stderr);
  const blocks = result.stdout.trim().split('\n\n');
  assert.equal(blocks.length, run('--kinds', 'list').stdout.trim().split('\n').length);
  for (const block of blocks) {
    const [head, file, signal] = block.split('\n');
    assert.match(head, /^UX-\d{3} \| /);
    const id = head.split(' | ')[0];
    assert.match(file, new RegExp(`^  file: .*/skills/failure-modes/references/${id}-[a-z0-9-]+\\.md$`));
    assert.match(signal, /^  signal: \S.{100,}$/, `${id} has no usable Signal line`);
  }
});

test('--signals composes with the other flags in any position', () => {
  const a = run('--signals', '--kinds', 'form', '--exclude-detection', 'scanner,conformance').stdout;
  const b = run('--kinds', 'form', '--exclude-detection', 'scanner,conformance', '--signals').stdout;
  assert.equal(a, b);
  assert.ok(!a.includes('| scanner |'));
});
