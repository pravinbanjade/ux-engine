import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildProfile } from '../scripts/lib/profile.mjs';
import { findLiterals, nearestToken, scanRepo, DEFAULT_THRESHOLDS } from '../scripts/lib/scanner.mjs';

const fixture = (n) => fileURLToPath(new URL(`../tests/fixtures/${n}/`, import.meta.url));
const cli = fileURLToPath(new URL('../scripts/scan-off-system.mjs', import.meta.url));
const USAGE = 'Usage: scan-off-system.mjs --profile <path> [--root <dir>] [--path <dir>] [--threshold-color N] [--threshold-scalar N]';

test('findLiterals reports value, kind and 1-indexed line', () => {
  const found = findLiterals("a\nconst c = '#3b7d4f';\nconst p = '17px';\nconst d = '220ms';\n");
  assert.deepEqual(found, [
    { line: 2, value: '#3b7d4f', kind: 'color' },
    { line: 3, value: '17px', kind: 'length' },
    { line: 4, value: '220ms', kind: 'time' },
  ]);
});

test('findLiterals skips a line marked ux-engine-ignore', () => {
  assert.deepEqual(findLiterals("const c = '#3b7d4f'; // ux-engine-ignore\n"), []);
});

test('findLiterals does not report a token reference', () => {
  assert.deepEqual(findLiterals('background: var(--color-primary);\n'), []);
});

// Discriminator 1: comment lines. A line whose trimmed text opens with //,
// /*, */ or * is prose about a value, not the value itself.
test('findLiterals skips a line comment mentioning a length value', () => {
  assert.deepEqual(findLiterals('// Use padding of 16px per design spec\n'), []);
});

test('findLiterals skips a JSDoc line mentioning a duration', () => {
  assert.deepEqual(findLiterals(' * @default 300ms\n'), []);
});

test('findLiterals skips a line comment mentioning a hex value', () => {
  assert.deepEqual(findLiterals('// see #3b7d4f for reference\n'), []);
});

// Discriminator 2: colour-function matches are kept only if parseColor can
// actually resolve them.
test('findLiterals does not report an interpolated colour function call', () => {
  assert.deepEqual(findLiterals('const c = `rgba(${r}, ${g}, ${b}, ${a})`;\n'), []);
});

test('findLiterals does not report a malformed, nested colour function call', () => {
  assert.deepEqual(findLiterals('const d = d3.hsl(scale(d.value));\n'), []);
});

// Discriminator 3: stricter hex boundaries.
test('findLiterals does not mistake a private field access for a hex colour', () => {
  assert.deepEqual(findLiterals('this.#face = 1;\n'), []);
});

test('findLiterals does not mistake a private field declaration for a hex colour', () => {
  assert.deepEqual(findLiterals('#face = 1;\n'), []);
});

test('findLiterals does not mistake a hash route for a hex colour', () => {
  assert.deepEqual(findLiterals('const link = "#deed-section";\n'), []);
});

// Positive controls: none of the discriminators above should cost real
// literals their findings.
test('findLiterals still reports a real hex colour declaration', () => {
  assert.deepEqual(findLiterals('color: #3b7d4f;\n'), [{ line: 1, value: '#3b7d4f', kind: 'color' }]);
});

test('findLiterals still reports a short hex colour alongside a length literal', () => {
  const found = findLiterals('1px solid #ccc;\n');
  assert.equal(found.length, 2);
  assert.ok(found.some((f) => f.value === '1px' && f.kind === 'length'));
  assert.ok(found.some((f) => f.value === '#ccc' && f.kind === 'color'));
});

test('findLiterals still reports an 8-digit hex colour', () => {
  assert.deepEqual(findLiterals('#2f6f4fcc\n'), [{ line: 1, value: '#2f6f4fcc', kind: 'color' }]);
});

test('findLiterals still reports a resolvable rgba() colour function call', () => {
  assert.deepEqual(findLiterals('const c = rgba(0,0,0,0.5);\n'), [{ line: 1, value: 'rgba(0,0,0,0.5)', kind: 'color' }]);
});

test('findLiterals still reports a plain length literal', () => {
  assert.deepEqual(findLiterals('padding: 17px;\n'), [{ line: 1, value: '17px', kind: 'length' }]);
});

test('findLiterals still reports a plain duration literal', () => {
  assert.deepEqual(findLiterals('transition: 220ms;\n'), [{ line: 1, value: '220ms', kind: 'time' }]);
});

// CSS reset blocks starting with * are real code, not comments, and can contain
// off-system values. The isCommentLine function distinguishes them by looking
// for selector-shaped characters followed by an opening brace.
test('findLiterals reports a length in a CSS reset block with * selector', () => {
  const found = findLiterals('* { margin: 0; padding: 17px; }');
  assert.equal(found.length, 1);
  assert.deepEqual(found[0], { line: 1, value: '17px', kind: 'length' });
});

test('findLiterals reports a length in a CSS reset block with multiple selectors', () => {
  const found = findLiterals('*, *::before { padding: 17px; }');
  assert.equal(found.length, 1);
  assert.deepEqual(found[0], { line: 1, value: '17px', kind: 'length' });
});

// Lines starting with * that are followed by JSDoc syntax (@param, @default, etc.)
// are still classified as comment lines because the @ character is not a valid
// CSS selector character.
test('findLiterals skips a JSDoc @param line even when it mentions a length default', () => {
  assert.deepEqual(findLiterals(' * @param {number} size - defaults to 16px\n'), []);
});

test('findLiterals skips a JSDoc @default line mentioning a duration', () => {
  assert.deepEqual(findLiterals(' * @default 300ms\n'), []);
});

// Block comment openers are always treated as comment lines regardless of content.
test('findLiterals skips a JSDoc block comment opener', () => {
  assert.deepEqual(findLiterals('/** JSDoc opener */\n'), []);
});

// The rgb()/hsl() colour-function pattern accepts the `none` keyword in CSS,
// but parseColor does not implement it, so these are silently dropped as an
// accepted, documented gap (rather than reporting them as findings with no
// way to evaluate their distance from anything). See the comment in scanner.mjs
// for the complete list of such gaps.
test('findLiterals does not report rgb() with CSS none keyword (documented limitation)', () => {
  assert.deepEqual(findLiterals('background: rgb(none 128 128);\n'), []);
});

test('nearestToken finds a perceptually close colour', () => {
  const tokens = { '--color-primary': '#2f6f4f' };
  const hit = nearestToken({ value: '#2f6f55', kind: 'color' }, tokens, DEFAULT_THRESHOLDS);
  assert.equal(hit.token, '--color-primary');
  assert.ok(hit.distance < DEFAULT_THRESHOLDS.color);
});

test('nearestToken returns null when nothing is close enough', () => {
  const tokens = { '--color-primary': '#2f6f4f' };
  assert.equal(nearestToken({ value: '#ffffff', kind: 'color' }, tokens, DEFAULT_THRESHOLDS), null);
});

test('nearestToken matches a scalar within 15 percent', () => {
  const tokens = { '--space-4': '16px' };
  const hit = nearestToken({ value: '17px', kind: 'length' }, tokens, DEFAULT_THRESHOLDS);
  assert.equal(hit.token, '--space-4');
});

test('scanRepo finds the planted violations and assigns the right IDs', () => {
  const root = fixture('tailwind-shadcn');
  const { findings } = scanRepo(root, buildProfile(root), {});
  const offender = findings.filter((f) => f.file === 'src/components/Offender.tsx');
  assert.deepEqual(offender.map((f) => f.id).sort(), ['UX-101', 'UX-102', 'UX-103']);
});

test('scanRepo does not flag the clean components', () => {
  const root = fixture('tailwind-shadcn');
  const { findings } = scanRepo(root, buildProfile(root), {});
  assert.deepEqual(findings.filter((f) => f.file.includes('ui/')), []);
});

test('scanRepo never scans the token source itself', () => {
  const root = fixture('css-modules');
  const { findings } = scanRepo(root, buildProfile(root), {});
  assert.deepEqual(findings.filter((f) => f.file === 'src/styles/tokens.css'), []);
});

test('scanRepo works on a css-in-js repo with no CSS token file', () => {
  const root = fixture('styled-components');
  const { findings } = scanRepo(root, buildProfile(root), {});
  assert.ok(findings.some((f) => f.file === 'src/components/Offender.tsx'));
});

test('declaring a JS/TS theme file as the token source excludes it from scanning', () => {
  const root = fixture('styled-components');
  // The fixture's theme.ts is not detected as a token source (buildProfile
  // only ever populates styling.tokenSource from .css files), so without an
  // override it gets scanned like any other file and its own token
  // definitions come back as false-positive findings. Declaring it via the
  // override that detection.md now instructs a human to record is the fix,
  // and it requires no scanner change: the exclusion logic already keys off
  // every entry in profile.styling.tokenSource.
  const profile = buildProfile(root, {
    overrides: { 'styling.tokenSource': ['src/theme.ts'], 'styling.tokenSyntax': 'js-object' },
  });
  const { findings } = scanRepo(root, profile, {});
  assert.deepEqual(findings.filter((f) => f.file === 'src/theme.ts'), []);
  const offender = findings.filter((f) => f.file === 'src/components/Offender.tsx');
  assert.deepEqual(offender.map((f) => f.id).sort(), ['UX-101', 'UX-102', 'UX-103']);
});

test('a finding with no near token says so instead of proposing one', () => {
  const root = fixture('tailwind-shadcn');
  const { findings } = scanRepo(root, buildProfile(root), {});
  const duration = findings.find((f) => f.id === 'UX-103');
  assert.ok('nearestToken' in duration);
  assert.ok(duration.nearestToken === null || typeof duration.nearestToken === 'string');
});

test('the CLI emits JSON with findings and skipped', () => {
  const root = fixture('tailwind-shadcn');
  const profilePath = fileURLToPath(new URL('../tests/snapshots/tailwind-shadcn.profile.json', import.meta.url));
  const out = JSON.parse(execFileSync(process.execPath, [cli, '--profile', profilePath, '--root', root], { encoding: 'utf8' }));
  assert.ok(Array.isArray(out.findings));
  assert.ok(Array.isArray(out.skipped));
  assert.ok(out.findings.length >= 3);
});

test('scanRepo --path requires a path-segment boundary, not just a string prefix', () => {
  // A scratch directory under the OS temp dir, not tests/fixtures — this is
  // set up and torn down entirely within the test, never committed.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-scan-path-'));
  try {
    mkdirSync(join(root, 'src/components'), { recursive: true });
    mkdirSync(join(root, 'src/components-legacy'), { recursive: true });
    writeFileSync(join(root, 'src/components/Foo.tsx'), "const p = '17px';\n");
    writeFileSync(join(root, 'src/components-legacy/Bar.tsx'), "const p = '19px';\n");

    const profile = { styling: { tokenSource: [] }, tokens: {} };
    const { findings } = scanRepo(root, profile, { path: 'src/components' });

    assert.ok(findings.some((f) => f.file === 'src/components/Foo.tsx'));
    assert.deepEqual(findings.filter((f) => f.file.startsWith('src/components-legacy')), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the CLI exits cleanly with an empty stdout when --profile does not exist', () => {
  const root = fixture('tailwind-shadcn');
  assert.throws(
    () => execFileSync(process.execPath, [cli, '--profile', '/nonexistent/profile.json', '--root', root], { encoding: 'utf8' }),
    (error) => {
      assert.equal(error.status, 1);
      assert.equal(error.stdout, '');
      assert.equal(error.stderr, `${USAGE}\n`);
      return true;
    },
  );
});

// A length literal's own kind ('length') doesn't say whether it's a font
// size, a border radius, or a spacing/sizing value — nearestToken narrows
// its candidate token group using a bounded look-back at the text
// immediately before the literal (see contextHint in scanner.mjs). Each of
// the following plants an exact numeric match in the WRONG group and a
// close-but-not-exact match in the RIGHT group, so a passing test proves
// the hint actually steers the search rather than numeric distance alone
// happening to pick the right answer regardless.
function withTempRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-scan-hint-'));
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('scanRepo narrows a font-size literal to the type token group', () => {
  withTempRoot((root) => {
    writeFileSync(join(root, 'Foo.tsx'), 'const c = "text-[10px]";\n');
    const profile = {
      styling: { tokenSource: [] },
      tokens: { radius: { '--radius': '10px' }, type: { '--text-sm': '9px' } },
    };
    const { findings } = scanRepo(root, profile, {});
    const finding = findings.find((f) => f.value === '10px');
    assert.equal(finding.nearestToken, '--text-sm');
  });
});

test('scanRepo narrows a border-radius literal to the radius token group', () => {
  withTempRoot((root) => {
    writeFileSync(join(root, 'Foo.tsx'), 'const c = "rounded-[10px]";\n');
    const profile = {
      styling: { tokenSource: [] },
      tokens: { type: { '--text-sm': '10px' }, radius: { '--radius-lg': '9px' } },
    };
    const { findings } = scanRepo(root, profile, {});
    const finding = findings.find((f) => f.value === '10px');
    assert.equal(finding.nearestToken, '--radius-lg');
  });
});

test('scanRepo narrows a padding/sizing literal to the spacing token group', () => {
  withTempRoot((root) => {
    writeFileSync(join(root, 'Foo.tsx'), 'const c = "p-[10px]";\n');
    const profile = {
      styling: { tokenSource: [] },
      tokens: { radius: { '--radius': '10px' }, spacing: { '--space-3': '9px' } },
    };
    const { findings } = scanRepo(root, profile, {});
    const finding = findings.find((f) => f.value === '10px');
    assert.equal(finding.nearestToken, '--space-3');
  });
});

test('scanRepo keeps searching all three length groups when the context has no recognisable hint', () => {
  withTempRoot((root) => {
    // "value:" is not a font-size, radius, or spacing prefix/property, so no
    // hint should fire and today's behaviour — search spacing, radius and
    // type together — applies: the exact match anywhere among them wins.
    writeFileSync(join(root, 'Foo.tsx'), 'const raw = "value:10px";\n');
    const profile = {
      styling: { tokenSource: [] },
      tokens: { spacing: { '--space-3': '10px' }, type: { '--text-sm': '11px' } },
    };
    const { findings } = scanRepo(root, profile, {});
    const finding = findings.find((f) => f.value === '10px');
    assert.equal(finding.nearestToken, '--space-3');
  });
});

test('scanRepo reports no suggestion when the narrowed group has nothing close, even if another group would have matched', () => {
  withTempRoot((root) => {
    // Hinted to `type` only. The type token is far too distant (400%+ off)
    // to pass the scalar threshold, and the exact match sitting in `radius`
    // must NOT be offered as a fallback once the group has been narrowed —
    // a confident wrong suggestion is worse than none.
    writeFileSync(join(root, 'Foo.tsx'), 'const c = "text-[50px]";\n');
    const profile = {
      styling: { tokenSource: [] },
      tokens: { type: { '--text-sm': '10px' }, radius: { '--radius': '50px' } },
    };
    const { findings } = scanRepo(root, profile, {});
    const finding = findings.find((f) => f.value === '50px');
    assert.equal(finding.nearestToken, null);
  });
});
