import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('buildProfile merges tokens from every stylesheet in tokenSource, later file wins on name collision', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-profile-test-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'scratch', private: true }));
    mkdirSync(join(root, 'src/styles'), { recursive: true });
    // Alphabetically first: walkFiles sorts, so this file's props are spread first.
    writeFileSync(
      join(root, 'src/styles/a.css'),
      ':root {\n  --color-primary: #111111;\n  --color-secondary: #222222;\n  --spacing-1: 4px;\n}\n',
    );
    // Alphabetically second: spread later, so it wins on the shared property name.
    writeFileSync(
      join(root, 'src/styles/b.css'),
      ':root {\n  --color-primary: #ffffff;\n  --color-accent: #333333;\n  --spacing-2: 8px;\n}\n',
    );

    const p = buildProfile(root, { now: NOW });

    assert.deepEqual(p.styling.tokenSource, ['src/styles/a.css', 'src/styles/b.css']);
    // Properties unique to each file are both present, proving the merge covers every
    // entry of tokenSource and not just the first.
    assert.equal(p.tokens.color['--color-secondary'], '#222222');
    assert.equal(p.tokens.color['--color-accent'], '#333333');
    // --color-primary is defined in both files with different values. buildProfile merges
    // via object spread in tokenSource order, so the later file (b.css) wins. Pinned here
    // as documented behavior, not left as an accident.
    assert.equal(p.tokens.color['--color-primary'], '#ffffff');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('buildProfile applies overrides and leaves everything else detected', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-profile-test-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'scratch', private: true }));

    const p = buildProfile(root, {
      now: NOW,
      overrides: { 'components.dir': 'src/widgets', 'components.variantMechanism': 'a-custom-switch' },
    });

    assert.equal(p.components.dir, 'src/widgets');
    assert.equal(p.components.variantMechanism, 'a-custom-switch');
    // Untouched groups still reflect plain detection: no manifest deps, no stylesheets.
    assert.equal(p.styling.system, null);
    assert.equal(p.conventions.framework, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an overridden styling.tokenSource is honoured for extraction and staleness, not just recorded', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-profile-test-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'scratch', private: true }));
    mkdirSync(join(root, 'src/styles'), { recursive: true });
    // A .scss extension: detectStyling's walkFiles only looks at .css, so automatic
    // detection would never find this file on its own.
    writeFileSync(
      join(root, 'src/styles/tokens.scss'),
      ':root {\n  --color-primary: #111111;\n  --color-secondary: #222222;\n  --spacing-1: 4px;\n}\n',
    );

    const p = buildProfile(root, { now: NOW, overrides: { 'styling.tokenSource': ['src/styles/tokens.scss'] } });

    assert.deepEqual(p.styling.tokenSource, ['src/styles/tokens.scss']);
    assert.equal(p.tokens.color['--color-primary'], '#111111');
    assert.ok(p.derivedFrom.some((e) => e.path === 'src/styles/tokens.scss'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a group touched by an override scores high even when detection alone would call it medium', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-profile-test-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'scratch', private: true }));

    // No stylesheets at all, so scoreConfidence alone would see a truthy `system` with
    // zero tokens and call this 'medium' — proving the 'high' below comes from the
    // override bump, not from scoreConfidence happening to agree.
    const p = buildProfile(root, { now: NOW, overrides: { 'styling.system': 'a-hand-named-approach' } });

    assert.equal(p.styling.system, 'a-hand-named-approach');
    assert.equal(p.confidence.styling, 'high');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
