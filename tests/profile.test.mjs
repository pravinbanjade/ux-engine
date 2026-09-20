import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildProfile, scoreConfidence } from '../scripts/lib/profile.mjs';

const fixture = (n) => fileURLToPath(new URL(`../tests/fixtures/${n}/`, import.meta.url));
const snapshot = (n) => fileURLToPath(new URL(`../tests/snapshots/${n}.profile.json`, import.meta.url));
const NOW = '2026-01-01T00:00:00.000Z';

for (const name of ['tailwind-shadcn', 'css-modules', 'styled-components']) {
  test(`profile for ${name} matches its snapshot`, () => {
    const actual = buildProfile(fixture(name), { now: NOW });
    assert.ok(existsSync(snapshot(name)), `snapshot missing: write it from the first run and review it by hand`);
    assert.deepEqual(actual, JSON.parse(readFileSync(snapshot(name), 'utf8')));
  });
}

test('derivedFrom records a sha256 per source file', () => {
  const p = buildProfile(fixture('tailwind-shadcn'), { now: NOW });
  assert.ok(p.derivedFrom.length >= 2);
  for (const entry of p.derivedFrom) assert.match(entry.sha256, /^[0-9a-f]{64}$/);
  assert.ok(p.derivedFrom.some((e) => e.path === 'package.json'));
});

test('schema version is 1', () => {
  assert.equal(buildProfile(fixture('css-modules'), { now: NOW }).version, 1);
});

test('styling confidence is high when tokens were found', () => {
  const p = buildProfile(fixture('tailwind-shadcn'), { now: NOW });
  assert.equal(p.confidence.styling, 'high');
  assert.equal(p.confidence.components, 'high');
});

test('styling confidence is medium when the system is known but tokens are not in CSS', () => {
  const p = buildProfile(fixture('styled-components'), { now: NOW });
  assert.equal(p.confidence.styling, 'medium');
});

test('scoreConfidence reports low for an unknown styling system', () => {
  const c = scoreConfidence({
    styling: { system: null, tokenSource: [] },
    components: { dir: null, library: null },
    conventions: { framework: null, testRunner: null },
    tokens: { color: {}, spacing: {}, radius: {}, type: {}, shadow: {}, motion: {}, other: {} },
  });
  assert.deepEqual(c, { styling: 'low', components: 'low', conventions: 'low' });
});
