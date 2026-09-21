import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildProfile, scoreConfidence, setPath, getPath } from '../scripts/lib/profile.mjs';

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

test('setPath refuses __proto__, prototype and constructor segments and never touches Object.prototype', () => {
  const beforeNames = Object.getOwnPropertyNames(Object.prototype);

  // Each of these would have polluted Object.prototype before the segment guard existed:
  // this exact call previously made ({}).polluted === 'yes' for the rest of the process.
  assert.equal(setPath({ styling: {} }, '__proto__.polluted', 'yes'), false);
  assert.equal(setPath({}, 'a.prototype.b', 'yes'), false);
  assert.equal(setPath({}, 'constructor.polluted2', 'yes'), false);

  assert.equal(({}).polluted, undefined);
  assert.equal(({}).polluted2, undefined);
  assert.deepEqual(Object.getOwnPropertyNames(Object.prototype), beforeNames);

  // A legitimate path still works.
  const obj = {};
  assert.equal(setPath(obj, 'components.dir', 'src/ui'), true);
  assert.equal(obj.components.dir, 'src/ui');
});

test('getPath refuses __proto__, prototype and constructor segments', () => {
  assert.equal(getPath({}, '__proto__.polluted'), undefined);
  assert.equal(getPath({}, 'a.prototype.b'), undefined);
  assert.equal(getPath({}, 'constructor.name'), undefined);
  assert.equal(getPath({ a: { b: 'value' } }, 'a.b'), 'value');
});

test('buildProfile refuses a dangerous override path even if a caller bypasses the allowlist', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-profile-test-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'scratch', private: true }));

    const p = buildProfile(root, { now: NOW, overrides: { '__proto__.polluted': 'yes' } });

    assert.equal(({}).polluted, undefined);
    assert.equal(p.polluted, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an override for styling.tokenSource that is not an array of strings is ignored, not a crash', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-profile-test-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'scratch', private: true }));
    mkdirSync(join(root, 'src/styles'), { recursive: true });
    writeFileSync(
      join(root, 'src/styles/app.css'),
      ':root {\n  --color-primary: #111111;\n  --color-secondary: #222222;\n  --spacing-1: 4px;\n}\n',
    );

    // Before this validation, buildProfile would iterate the characters of this string
    // as if each were a filename and call readFileSync on them, crashing hard.
    const p = buildProfile(root, { now: NOW, overrides: { 'styling.tokenSource': 'not-an-array' } });

    assert.deepEqual(p.styling.tokenSource, ['src/styles/app.css']);
    assert.equal(p.tokens.color['--color-primary'], '#111111');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a styling.tokenSource entry with a relative escape (../) is refused: contributes no tokens and no derivedFrom entry', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-profile-test-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'scratch', private: true }));
    mkdirSync(join(root, 'src/styles'), { recursive: true });
    // A legitimate in-repo stylesheet
    writeFileSync(
      join(root, 'src/styles/app.css'),
      ':root {\n  --color-primary: #111111;\n  --color-secondary: #222222;\n}\n',
    );
    // A hostile escape path pointing outside repo
    // Note: we don't actually create the file since the containment check happens before existsSync

    // Override with both an in-repo and an escape path
    const p = buildProfile(root, {
      now: NOW,
      overrides: {
        'styling.tokenSource': ['src/styles/app.css', '../secret.css'],
      },
    });

    // Only the legitimate in-repo entry is recorded
    assert.deepEqual(p.styling.tokenSource, ['src/styles/app.css']);
    // Only the legitimate token is extracted
    assert.equal(p.tokens.color['--color-primary'], '#111111');
    assert.equal(p.tokens.color['--color-secondary'], '#222222');
    assert.equal(p.tokens.color['--color-secret'], undefined);
    // Only the legitimate file is in derivedFrom
    assert.ok(p.derivedFrom.some((e) => e.path === 'src/styles/app.css'));
    assert.ok(!p.derivedFrom.some((e) => e.path.includes('secret.css')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a styling.tokenSource entry that is a symlink pointing outside the repo is refused', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-profile-test-'));
  const outside = mkdtempSync(join(tmpdir(), 'ux-engine-profile-test-outside-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'scratch', private: true }));
    mkdirSync(join(root, 'src/styles'), { recursive: true });
    // A legitimate in-repo stylesheet
    writeFileSync(
      join(root, 'src/styles/app.css'),
      ':root {\n  --color-primary: #111111;\n}\n',
    );
    // An out-of-repo stylesheet
    writeFileSync(
      join(outside, 'secret.css'),
      ':root {\n  --color-secret: #333333;\n}\n',
    );

    // Create an in-repo symlink pointing to the out-of-repo file
    try {
      symlinkSync(join(outside, 'secret.css'), join(root, 'src/styles/linked.css'));
    } catch (e) {
      // Skip test if platform cannot create symlinks
      console.log('Skipping symlink test: platform does not support symlinks');
      return;
    }

    // Override with both an in-repo file and an in-repo symlink to an outside file
    const p = buildProfile(root, {
      now: NOW,
      overrides: {
        'styling.tokenSource': ['src/styles/app.css', 'src/styles/linked.css'],
      },
    });

    // Only the legitimate in-repo file is recorded, the symlink escape is refused
    assert.deepEqual(p.styling.tokenSource, ['src/styles/app.css']);
    // Only the legitimate token is extracted
    assert.equal(p.tokens.color['--color-primary'], '#111111');
    assert.equal(p.tokens.color['--color-secret'], undefined);
    // Only the legitimate file is in derivedFrom
    assert.ok(p.derivedFrom.some((e) => e.path === 'src/styles/app.css'));
    assert.ok(!p.derivedFrom.some((e) => e.path.includes('linked.css')));
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('a styling.tokenSource entry naming a directory is skipped with a warning', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-profile-test-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'scratch', private: true }));
    mkdirSync(join(root, 'src/styles'), { recursive: true });
    // A legitimate in-repo stylesheet
    writeFileSync(
      join(root, 'src/styles/app.css'),
      ':root {\n  --color-primary: #111111;\n}\n',
    );

    // Override with both a file and a directory
    const p = buildProfile(root, {
      now: NOW,
      overrides: {
        'styling.tokenSource': ['src/styles/app.css', 'src/styles'],
      },
    });

    // Only the file entry is recorded, the directory is skipped
    assert.deepEqual(p.styling.tokenSource, ['src/styles/app.css']);
    // Only the file token is extracted
    assert.equal(p.tokens.color['--color-primary'], '#111111');
    // Only the file is in derivedFrom
    assert.ok(p.derivedFrom.some((e) => e.path === 'src/styles/app.css'));
    assert.ok(!p.derivedFrom.some((e) => e.path === 'src/styles'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a styling.tokenSource entry with an absolute path is skipped if outside the repo', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-profile-test-'));
  const outside = mkdtempSync(join(tmpdir(), 'ux-engine-profile-test-outside-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'scratch', private: true }));
    mkdirSync(join(root, 'src/styles'), { recursive: true });
    // A legitimate in-repo stylesheet
    writeFileSync(
      join(root, 'src/styles/app.css'),
      ':root {\n  --color-primary: #111111;\n}\n',
    );
    // An out-of-repo stylesheet
    writeFileSync(
      join(outside, 'secret.css'),
      ':root {\n  --color-secret: #333333;\n}\n',
    );

    // Override with both an in-repo file and an absolute outside path
    const p = buildProfile(root, {
      now: NOW,
      overrides: {
        'styling.tokenSource': ['src/styles/app.css', join(outside, 'secret.css')],
      },
    });

    // Only the legitimate in-repo entry is recorded
    assert.deepEqual(p.styling.tokenSource, ['src/styles/app.css']);
    // Only the legitimate token is extracted
    assert.equal(p.tokens.color['--color-primary'], '#111111');
    assert.equal(p.tokens.color['--color-secret'], undefined);
    // Only the legitimate file is in derivedFrom
    assert.ok(p.derivedFrom.some((e) => e.path === 'src/styles/app.css'));
    assert.ok(!p.derivedFrom.some((e) => e.path.includes('secret.css')));
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('a styling.tokenSource entry naming a file that does not exist is skipped rather than throwing', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-profile-test-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'scratch', private: true }));
    mkdirSync(join(root, 'src/styles'), { recursive: true });
    // A real stylesheet
    writeFileSync(
      join(root, 'src/styles/app.css'),
      ':root {\n  --color-primary: #111111;\n}\n',
    );

    // Override with both an existing and a non-existent stylesheet
    const p = buildProfile(root, {
      now: NOW,
      overrides: {
        'styling.tokenSource': ['src/styles/app.css', 'src/styles/nonexistent.css'],
      },
    });

    // Only the existing entry is recorded
    assert.deepEqual(p.styling.tokenSource, ['src/styles/app.css']);
    // The existing token is extracted
    assert.equal(p.tokens.color['--color-primary'], '#111111');
    // Only the existing file is in derivedFrom
    assert.ok(p.derivedFrom.some((e) => e.path === 'src/styles/app.css'));
    assert.ok(!p.derivedFrom.some((e) => e.path === 'src/styles/nonexistent.css'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
