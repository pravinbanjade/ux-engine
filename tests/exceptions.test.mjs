import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchGlob, parseExceptions, matchesException } from '../scripts/lib/exceptions.mjs';

test('matchGlob: * does not cross a path separator', () => {
  assert.equal(matchGlob('src/*.tsx', 'src/Navbar.tsx'), true);
  assert.equal(matchGlob('src/*.tsx', 'src/ui/Navbar.tsx'), false);
});

test('matchGlob: ** crosses path separators', () => {
  assert.equal(matchGlob('src/**', 'src/ui/Navbar.tsx'), true);
  assert.equal(matchGlob('src/**/*.tsx', 'src/a/b/Navbar.tsx'), true);
  assert.equal(matchGlob('src/**', 'lib/ui/Navbar.tsx'), false);
});

test('matchGlob: ? matches exactly one non-separator character', () => {
  assert.equal(matchGlob('src/v?/a.tsx', 'src/v2/a.tsx'), true);
  assert.equal(matchGlob('src/v?/a.tsx', 'src/v22/a.tsx'), false);
});

test('matchGlob: a bare path matches only itself', () => {
  assert.equal(matchGlob('src/a.tsx', 'src/a.tsx'), true);
  assert.equal(matchGlob('src/a.tsx', 'src/a.tsx.bak'), false);
});

test('matchGlob: regex metacharacters in a glob are literal', () => {
  assert.equal(matchGlob('src/a+b.tsx', 'src/a+b.tsx'), true);
  assert.equal(matchGlob('src/a+b.tsx', 'src/aab.tsx'), false);
});

test('parseExceptions reads the documented three-field form', () => {
  const body = [
    'One per line: `<mode-id or *> | <glob> | <reason>`',
    '',
    'UX-101 | src/legacy/** | pre-migration theme',
    '*      | src/vendor/** | third-party, not ours to restyle',
  ].join('\n');
  const { entries, warnings } = parseExceptions(body);
  assert.deepEqual(warnings, []);
  assert.deepEqual(entries, [
    { id: 'UX-101', glob: 'src/legacy/**', reason: 'pre-migration theme', line: 3 },
    { id: '*', glob: 'src/vendor/**', reason: 'third-party, not ours to restyle', line: 4 },
  ]);
});

test('parseExceptions ignores prose and the placeholder', () => {
  const body = '_None recorded. Add entries here when a deviation is intentional._';
  assert.deepEqual(parseExceptions(body), { entries: [], warnings: [] });
});

test('parseExceptions warns on a malformed mode id instead of ignoring it', () => {
  const { entries, warnings } = parseExceptions('ux-1 | src/** | typo in the id');
  assert.deepEqual(entries, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /line 1/);
  assert.match(warnings[0], /ux-1/);
});

test('parseExceptions warns when a field is missing', () => {
  const { entries, warnings } = parseExceptions('UX-101 | src/legacy/**');
  assert.deepEqual(entries, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /line 1/);
});

test('parseExceptions warns when the reason is empty', () => {
  const { entries, warnings } = parseExceptions('UX-101 | src/legacy/** |   ');
  assert.deepEqual(entries, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /reason/);
});

test('matchesException needs both the id and the path to match', () => {
  const { entries } = parseExceptions('UX-101 | src/legacy/** | reason');
  assert.ok(matchesException({ id: 'UX-101', file: 'src/legacy/a.tsx' }, entries));
  assert.equal(matchesException({ id: 'UX-102', file: 'src/legacy/a.tsx' }, entries), null);
  assert.equal(matchesException({ id: 'UX-101', file: 'src/app/a.tsx' }, entries), null);
});

test('matchesException honours a wildcard id', () => {
  const { entries } = parseExceptions('* | src/vendor/** | reason');
  assert.ok(matchesException({ id: 'UX-046', file: 'src/vendor/a.tsx' }, entries));
});
