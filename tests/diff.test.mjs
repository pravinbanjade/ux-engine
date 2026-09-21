import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedRanges, inScope } from '../scripts/lib/diff.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });

// A real repo per test: diff parsing has to be proven against git's actual
// output, not a hand-written fixture that drifts from it.
function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'uxe-diff-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test');
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');
  return dir;
}

const lines = (n, prefix = 'line') => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).join('\n') + '\n';

test('changedRanges reports new-side ranges for an unstaged edit', () => {
  const dir = repo({ 'a.txt': lines(10) });
  writeFileSync(join(dir, 'a.txt'), lines(10).replace('line 4', 'CHANGED'));
  assert.deepEqual(changedRanges({ cwd: dir }), [{ file: 'a.txt', ranges: [{ start: 4, end: 4 }] }]);
  rmSync(dir, { recursive: true, force: true });
});

test('changedRanges covers staged and unstaged work together', () => {
  const dir = repo({ 'a.txt': lines(10), 'b.txt': lines(4) });
  writeFileSync(join(dir, 'a.txt'), lines(10).replace('line 2', 'STAGED'));
  git(dir, 'add', 'a.txt');
  writeFileSync(join(dir, 'b.txt'), lines(4).replace('line 3', 'UNSTAGED'));
  const changed = changedRanges({ cwd: dir });
  assert.deepEqual(changed.map((c) => c.file).sort(), ['a.txt', 'b.txt']);
  rmSync(dir, { recursive: true, force: true });
});

test('changedRanges reports a multi-line insertion as one range', () => {
  const dir = repo({ 'a.txt': lines(4) });
  writeFileSync(join(dir, 'a.txt'), 'line 1\nnew a\nnew b\nnew c\nline 2\nline 3\nline 4\n');
  assert.deepEqual(changedRanges({ cwd: dir }), [{ file: 'a.txt', ranges: [{ start: 2, end: 4 }] }]);
  rmSync(dir, { recursive: true, force: true });
});

test('changedRanges records a pure deletion at its new-side line', () => {
  const dir = repo({ 'a.txt': lines(4) });
  writeFileSync(join(dir, 'a.txt'), 'line 1\nline 3\nline 4\n');
  assert.deepEqual(changedRanges({ cwd: dir }), [{ file: 'a.txt', ranges: [{ start: 1, end: 1 }] }]);
  rmSync(dir, { recursive: true, force: true });
});

test('changedRanges omits a deleted file', () => {
  const dir = repo({ 'a.txt': lines(4), 'b.txt': lines(4) });
  rmSync(join(dir, 'b.txt'));
  assert.deepEqual(changedRanges({ cwd: dir }), []);
  rmSync(dir, { recursive: true, force: true });
});

test('changedRanges reports a rename under the new path', () => {
  const dir = repo({ 'a.txt': lines(10) });
  git(dir, 'mv', 'a.txt', 'c.txt');
  writeFileSync(join(dir, 'c.txt'), lines(10).replace('line 5', 'CHANGED'));
  const changed = changedRanges({ cwd: dir });
  assert.deepEqual(changed.map((c) => c.file), ['c.txt']);
  rmSync(dir, { recursive: true, force: true });
});

test('changedRanges accepts an explicit base ref', () => {
  const dir = repo({ 'a.txt': lines(4) });
  writeFileSync(join(dir, 'a.txt'), lines(4).replace('line 2', 'CHANGED'));
  git(dir, 'commit', '-aqm', 'second');
  assert.deepEqual(changedRanges({ cwd: dir, base: 'HEAD~1' }), [{ file: 'a.txt', ranges: [{ start: 2, end: 2 }] }]);
  rmSync(dir, { recursive: true, force: true });
});

test('changedRanges returns [] on a clean tree', () => {
  const dir = repo({ 'a.txt': lines(4) });
  assert.deepEqual(changedRanges({ cwd: dir }), []);
  rmSync(dir, { recursive: true, force: true });
});

const changed = [{ file: 'src/a.tsx', ranges: [{ start: 10, end: 12 }] }];

test('inScope accepts a finding inside a changed range', () => {
  assert.equal(inScope({ file: 'src/a.tsx', line: 11 }, changed), true);
});

test('inScope accepts a finding within the context margin', () => {
  assert.equal(inScope({ file: 'src/a.tsx', line: 7 }, changed), true);
  assert.equal(inScope({ file: 'src/a.tsx', line: 15 }, changed), true);
});

test('inScope rejects a finding beyond the margin', () => {
  assert.equal(inScope({ file: 'src/a.tsx', line: 6 }, changed), false);
  assert.equal(inScope({ file: 'src/a.tsx', line: 16 }, changed), false);
});

test('inScope rejects a finding in an untouched file', () => {
  assert.equal(inScope({ file: 'src/b.tsx', line: 11 }, changed), false);
});

test('inScope accepts a file-level finding in any touched file', () => {
  assert.equal(inScope({ file: 'src/a.tsx', line: null }, changed), true);
  assert.equal(inScope({ file: 'src/b.tsx', line: null }, changed), false);
});

test('inScope honours a custom margin', () => {
  assert.equal(inScope({ file: 'src/a.tsx', line: 6 }, changed, 4), true);
  assert.equal(inScope({ file: 'src/a.tsx', line: 11 }, changed, 0), true);
  assert.equal(inScope({ file: 'src/a.tsx', line: 9 }, changed, 0), false);
});
