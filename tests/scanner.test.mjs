import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildProfile } from '../scripts/lib/profile.mjs';
import { findLiterals, findLiteralsAt, nearestToken, scanRepo, DEFAULT_THRESHOLDS } from '../scripts/lib/scanner.mjs';

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

test('findLiterals does not report zero-valued lengths or durations, which are on-system in any design system', () => {
  // margin: 0, padding: 0, animation: 0s are always legitimate and need no token
  assert.deepEqual(findLiterals('margin: 0; padding: 0px; border-radius: 0rem; animation-duration: 0ms;'), []);
});

test('findLiterals still reports non-zero decimal lengths and durations even when close to zero', () => {
  // 0.5rem is off-system and should be flagged; distinguish it from 0rem
  const found = findLiterals('margin: 0.5rem; padding: 0.5px; duration: 0.5ms;\n');
  assert.equal(found.length, 3);
  assert.ok(found.some((f) => f.value === '0.5rem' && f.kind === 'length'));
  assert.ok(found.some((f) => f.value === '0.5px' && f.kind === 'length'));
  assert.ok(found.some((f) => f.value === '0.5ms' && f.kind === 'time'));
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

test('scanRepo works on a css-in-js repo once its theme is transcribed', () => {
  const root = fixture('styled-components');
  const profile = buildProfile(root, {
    overrides: {
      'styling.tokenSource': ['src/theme.ts'],
      'styling.tokenSyntax': 'js-object',
      tokens: {
        color: { '--color-primary': '#2f6f4f', '--color-surface': '#fbfdfb', '--color-danger': '#b3261e' },
        spacing: { '--space-2': '8px', '--space-4': '16px', '--space-6': '24px' },
        radius: { '--radius-md': '8px' },
        type: {},
        shadow: {},
        motion: { '--duration-fast': '150ms', '--duration-slow': '300ms', '--duration-slower': '500ms' },
        other: {},
      },
    },
  });
  const { findings } = scanRepo(root, profile, {});
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
    overrides: {
      'styling.tokenSource': ['src/theme.ts'],
      'styling.tokenSyntax': 'js-object',
      tokens: {
        color: { '--color-primary': '#2f6f4f', '--color-surface': '#fbfdfb', '--color-danger': '#b3261e' },
        spacing: { '--space-2': '8px', '--space-4': '16px', '--space-6': '24px' },
        radius: { '--radius-md': '8px' },
        type: {},
        shadow: {},
        motion: { '--duration-fast': '150ms', '--duration-slow': '300ms', '--duration-slower': '500ms' },
        other: {},
      },
    },
  });
  const { findings } = scanRepo(root, profile, {});
  assert.deepEqual(findings.filter((f) => f.file === 'src/theme.ts'), []);
  const offender = findings.filter((f) => f.file === 'src/components/Offender.tsx');
  assert.deepEqual(offender.map((f) => f.id).sort(), ['UX-101', 'UX-102', 'UX-103']);
});

test('a finding with no near token says so instead of proposing one', () => {
  const root = fixture('tailwind-shadcn');
  const { findings } = scanRepo(root, buildProfile(root), {});
  // Offender.tsx's planted "220ms" is 46.7% off the fixture's only motion
  // token (--duration-fast: 150ms) — well past the 15% scalar threshold —
  // so this must come back null, not merely "null or a string", which would
  // also pass if nearestToken proposed a wrong token.
  const duration = findings.find((f) => f.id === 'UX-103');
  assert.ok('nearestToken' in duration);
  assert.equal(duration.nearestToken, null);
  assert.equal(duration.distance, null);
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
    // padding: gives these a spacing hint. This test's subject is path
    // scoping; an unhinted length is now suppressed and would produce no
    // finding for either file, testing nothing.
    writeFileSync(join(root, 'src/components/Foo.tsx'), "const p = { padding: '17px' };\n");
    writeFileSync(join(root, 'src/components-legacy/Bar.tsx'), "const p = { padding: '19px' };\n");

    const profile = {
      styling: { tokenSource: [] },
      tokens: { spacing: { '--s1': '4px', '--s2': '8px', '--s3': '16px' } },
    };
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

test('scan-off-system.mjs exits 3 on a structurally invalid profile with empty stdout', () => {
  // Create a temporary directory with an invalid profile
  const tmpDir = mkdtempSync(join(tmpdir(), 'ux-engine-scan-invalid-profile-'));
  try {
    mkdirSync(join(tmpDir, '.ux-engine'), { recursive: true });
    const profilePath = join(tmpDir, '.ux-engine/profile.json');
    // A profile that parses as JSON but is missing required fields
    writeFileSync(profilePath, JSON.stringify({ version: 1, derivedFrom: [] }));

    assert.throws(
      () => execFileSync(process.execPath, [cli, '--profile', profilePath, '--root', tmpDir], { encoding: 'utf8' }),
      (error) => {
        assert.equal(error.status, 3);
        assert.equal(error.stdout, '', 'stdout must be empty on exit 3');
        assert.match(error.stderr, /Profile is missing or has an invalid/);
        return true;
      },
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
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
      tokens: { radius: { '--radius': '10px' }, type: { '--text-sm': '9px', '--text-lg': '40px', '--text-xl': '60px' } },
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
      tokens: { type: { '--text-sm': '10px' }, radius: { '--radius-lg': '9px', '--radius-xl': '40px', '--radius-2xl': '60px' } },
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
      tokens: { radius: { '--radius': '10px' }, spacing: { '--space-3': '9px', '--space-8': '40px', '--space-12': '60px' } },
    };
    const { findings } = scanRepo(root, profile, {});
    const finding = findings.find((f) => f.value === '10px');
    assert.equal(finding.nearestToken, '--space-3');
  });
});

test('scanRepo narrows a Tailwind v4 "size-" literal to the sizing token group', () => {
  withTempRoot((root) => {
    // Tailwind v4's `size-*` sets width and height together from one class:
    // a dimension, so it takes the sizing scale. The radius token is the
    // decoy — an exact 10px match in a group this literal has no business
    // being measured against, which is what the hint exists to rule out.
    writeFileSync(join(root, 'Foo.tsx'), 'const c = "size-[10px]";\n');
    const profile = {
      styling: { tokenSource: [] },
      tokens: {
        radius: { '--radius': '10px' },
        spacing: { '--space-3': '9px', '--space-8': '40px', '--space-12': '60px' },
        sizing: { '--w-sm': '11px', '--w-md': '40px', '--w-lg': '60px' },
      },
    };
    const { findings } = scanRepo(root, profile, {});
    const finding = findings.find((f) => f.value === '10px');
    assert.equal(finding.nearestToken, '--w-sm');
  });
});

test('scanRepo narrows a "min-width" property literal to the sizing token group', () => {
  withTempRoot((root) => {
    writeFileSync(join(root, 'Foo.css'), '.foo { min-width: 10px; }\n');
    const profile = {
      styling: { tokenSource: [] },
      tokens: {
        radius: { '--radius': '10px' },
        spacing: { '--space-3': '9px', '--space-8': '40px', '--space-12': '60px' },
        sizing: { '--w-sm': '11px', '--w-md': '40px', '--w-lg': '60px' },
      },
    };
    const { findings } = scanRepo(root, profile, {});
    const finding = findings.find((f) => f.value === '10px');
    assert.equal(finding.nearestToken, '--w-sm');
  });
});

test('scanRepo offers nothing for a length whose context has no recognisable hint', () => {
  withTempRoot((root) => {
    // "value:" is not a font-size, radius, or spacing prefix/property, so no
    // hint fires. This used to search spacing, radius and type together and
    // hand back the exact match from whichever group happened to hold one —
    // which is how a box-shadow offset was offered a border-radius token.
    // An unidentified context now gets no group and no suggestion.
    writeFileSync(join(root, 'Foo.tsx'), 'const raw = "value:10px";\n');
    const profile = {
      styling: { tokenSource: [] },
      tokens: { spacing: { '--space-3': '10px' }, type: { '--text-sm': '11px' }, radius: { '--radius': '40px' } },
    };
    const { findings, suppressed } = scanRepo(root, profile, {});
    assert.deepEqual(findings.filter((f) => f.value === '10px'), []);
    assert.ok(suppressed.some((x) => x.id === 'UX-102' && x.reason === 'no-context'));
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
      tokens: { type: { '--text-sm': '10px', '--text-md': '12px', '--text-lg': '14px' }, radius: { '--radius': '50px' } },
    };
    const { findings } = scanRepo(root, profile, {});
    const finding = findings.find((f) => f.value === '50px');
    assert.equal(finding.nearestToken, null);
  });
});

test('scanRepo continues scanning other files when one file has a read error, completing the scan and reporting findings from good files', () => {
  // The try/catch structures in scanRepo ensure that a failure reading or
  // parsing one file does not interrupt the entire scan. Test this by
  // scanning a directory with one readable, good file and one file that
  // fails to read (via a restricted-permission file), confirming that the
  // skipped list is populated while findings still come back.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-scan-skip-error-'));
  try {
    // padding: gives this a spacing hint. The subject here is that a bad
    // file does not abort the scan; an unhinted length would now be
    // suppressed and the "good file still reported" assertion would be
    // testing the hint rule instead.
    writeFileSync(join(root, 'good.tsx'), 'const c = { padding: "17px" };\n');
    // Create a file with no read permissions that will cause a read error
    writeFileSync(join(root, 'bad.tsx'), 'bad content\n');
    // This test may not work if running as root; skip the permission check in that case
    try {
      // eslint-disable-next-line no-bitwise
      execSync(`chmod 000 "${join(root, 'bad.tsx')}"`);
    } catch {
      // Skip this test if we can't set restricted permissions (e.g., running as root)
      return;
    }

    const profile = {
      styling: { tokenSource: [] },
      tokens: { spacing: { '--space-4': '16px', '--space-2': '8px', '--space-6': '24px' } },
    };
    const { findings, skipped } = scanRepo(root, profile, {});

    // The good file's findings should still be present
    const goodFinding = findings.find((f) => f.file === 'good.tsx');
    assert.ok(goodFinding, 'finding from good file is present despite bad.tsx');
    assert.equal(goodFinding.value, '17px');

    // The bad file should be in skipped with a reason (EACCES for permission denied)
    const badSkipped = skipped.find((s) => s.file === 'bad.tsx');
    assert.ok(badSkipped, 'bad file is in skipped');
    assert.ok(badSkipped.reason, 'skipped entry has a reason');
  } finally {
    // Restore permissions before cleanup
    try {
      // eslint-disable-next-line no-bitwise
      execSync(`chmod 644 "${join(root, 'bad.tsx')}" 2>/dev/null || true`);
    } catch {
      // Ignore
    }
    rmSync(root, { recursive: true, force: true });
  }
});

test('findLiteralsAt reports a 1-based column', () => {
  const raw = 'color: #3b7d4f;\n';
  const [found] = findLiteralsAt(raw);
  assert.equal(found.column, raw.indexOf('#3b7d4f') + 1);
  assert.equal(found.value, '#3b7d4f');
});

test('a stripped var() reference does not shift the columns after it', () => {
  // The scanner blanks `var(--x)` before matching so a token reference is
  // never itself a finding. Blanking must preserve length: deleting it
  // would make every column to its right point at the wrong character.
  const raw = 'border: var(--border-width) solid #3b7d4f; padding: 17px;\n';
  const found = findLiteralsAt(raw);
  const colour = found.find((f) => f.value === '#3b7d4f');
  const length = found.find((f) => f.value === '17px');
  assert.equal(colour.column, raw.indexOf('#3b7d4f') + 1);
  assert.equal(length.column, raw.indexOf('17px') + 1);
});

test('two identical literals on one line get distinct columns', () => {
  const raw = 'padding: 17px; margin: 17px;\n';
  const found = findLiteralsAt(raw).filter((f) => f.value === '17px');
  assert.equal(found.length, 2);
  assert.equal(found[0].column, raw.indexOf('17px') + 1);
  assert.equal(found[1].column, raw.lastIndexOf('17px') + 1);
});

test('findLiterals keeps its column-free shape', () => {
  // 49 assertions in this file deepEqual against {line, value, kind}.
  // findLiteralsAt is the positional API; findLiterals is not widened.
  assert.deepEqual(findLiterals('color: #3b7d4f;\n'), [{ line: 1, value: '#3b7d4f', kind: 'color' }]);
});

test('scanRepo findings carry the column of the literal', () => {
  const root = fixture('tailwind-shadcn');
  const { findings } = scanRepo(root, buildProfile(root), {});
  const colour = findings.find((f) => f.id === 'UX-101' && f.file === 'src/components/Offender.tsx');
  const source = readFileSync(join(root, 'src/components/Offender.tsx'), 'utf8').split('\n');
  const lineText = source[colour.line - 1];
  assert.equal(lineText.slice(colour.column - 1, colour.column - 1 + colour.value.length), colour.value);
});

test('a literal whose candidate set is not a scale produces no finding', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-gate-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/Thing.tsx'), "const s = { padding: '17px' };\n");
    // Two values is a pair, not a scale: nothing to snap 17px to.
    const profile = { styling: { tokenSource: [] }, tokens: { spacing: { '--a': '8px', '--b': '16px' } } };
    const { findings, suppressed } = scanRepo(root, profile, {});
    assert.deepEqual(findings, []);
    assert.equal(suppressed.length, 1);
    assert.equal(suppressed[0].id, 'UX-102');
    assert.equal(suppressed[0].distinctValues, 2);
    assert.equal(suppressed[0].count, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('suppression is counted once per mode and candidate set, not per literal', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-gate-count-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/A.tsx'), "const a = { padding: '17px' };\n");
    writeFileSync(join(root, 'src/B.tsx'), "const b = { padding: '19px' };\n");
    const profile = { styling: { tokenSource: [] }, tokens: { spacing: { '--a': '8px', '--b': '16px' } } };
    const { suppressed } = scanRepo(root, profile, {});
    assert.equal(suppressed.length, 1);
    assert.equal(suppressed[0].count, 2);
    assert.deepEqual(suppressed[0].groups, ['spacing']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a usable scale is not suppressed', () => {
  const root = fixture('tailwind-shadcn');
  const { findings, suppressed } = scanRepo(root, buildProfile(root), {});
  assert.deepEqual(suppressed, []);
  assert.deepEqual(
    findings.filter((f) => f.file === 'src/components/Offender.tsx').map((f) => f.id).sort(),
    ['UX-101', 'UX-102', 'UX-103'],
  );
});

test('a repo whose tokens were never transcribed is suppressed, not silent', () => {
  // The css-in-js fixture's tokens live in a JS object detection does not
  // parse, so the profile has none. Reporting every literal as "no near
  // token" would be noise; reporting nothing at all would be a lie. The
  // run says which modes it could not apply and to how many literals.
  const root = fixture('styled-components');
  const { findings, suppressed } = scanRepo(root, buildProfile(root), {});
  assert.deepEqual(findings.filter((f) => f.file === 'src/components/Offender.tsx'), []);
  assert.ok(suppressed.length > 0, 'the run must say why it found nothing');
  // distinctValues belongs to unusable-scale entries. A no-context entry has
  // no group and so no distinct count, which is the point of it.
  const unusable = suppressed.filter((s) => s.reason === 'unusable-scale');
  assert.ok(unusable.length > 0, 'the untranscribed tokens must be reported as an unusable scale');
  assert.ok(unusable.every((s) => s.distinctValues === 0));
});

test('a translucent literal never matches an opaque token', () => {
  // The restyle dogfood planned rgba(255,255,255,0.08) -> var(--background)
  // and rgba(38,64,139,0.5) -> var(--navy). Both drop the alpha and turn a
  // translucent surface opaque. There is no near token here; saying so is
  // the correct answer.
  const tokens = { '--background': '#ffffff', '--navy': '#26408B', '--dark': '#0F172B' };
  assert.equal(nearestToken({ value: 'rgba(255, 255, 255, 0.08)', kind: 'color' }, tokens, DEFAULT_THRESHOLDS), null);
  assert.equal(nearestToken({ value: 'rgba(38, 64, 139, 0.5)', kind: 'color' }, tokens, DEFAULT_THRESHOLDS), null);
  // An opaque literal still matches an opaque token.
  assert.equal(nearestToken({ value: '#fffffe', kind: 'color' }, tokens, DEFAULT_THRESHOLDS).token, '--background');
});

test('every value in a shorthand declaration keeps the property hint', () => {
  // Found by the restyle dogfood: `padding: 6px 16px` gave the second
  // value no hint, so it was matched against every length group at once
  // and picked a radius token — the restyle then wrote a 14px radius step
  // into a 16px padding. A shorthand's later values are still that
  // property's values.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-shorthand-'));
  try {
    writeFileSync(join(root, 'a.css'), '.a { padding: 6px 16px; }\n');
    const profile = {
      styling: { tokenSource: [] },
      tokens: {
        // The radius token is an exact match and the spacing token is not,
        // so an unhinted literal would pick radius. Only the hint can put
        // this on the spacing scale.
        spacing: { '--s1': '4px', '--s2': '17px', '--s3': '32px' },
        radius: { '--r1': '16px', '--r2': '20px', '--r3': '28px' },
      },
    };
    const { findings } = scanRepo(root, profile, {});
    const second = findings.find((f) => f.value === '16px');
    assert.equal(second.nearestToken, '--s2');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a property hint does not leak across a declaration boundary', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-hint-leak-'));
  try {
    writeFileSync(join(root, 'a.css'), '.a { padding: 4px; border-radius: 16px; }\n');
    const profile = {
      styling: { tokenSource: [] },
      tokens: {
        spacing: { '--s1': '4px', '--s2': '16px', '--s3': '32px' },
        radius: { '--r1': '17px', '--r2': '20px', '--r3': '28px' },
      },
    };
    const { findings } = scanRepo(root, profile, {});
    const radius = findings.find((f) => f.value === '16px');
    assert.equal(radius.nearestToken, '--r1', 'border-radius must not inherit the padding hint');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('directional spacing longhands carry the spacing hint', () => {
  // Found by the restyle dogfood: only `margin` and `padding` were listed,
  // so `margin-bottom: 12px` went unhinted, fell back to every length
  // group at once and was matched to a border-radius token. A longhand is
  // the same property.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-longhand-'));
  try {
    writeFileSync(join(root, 'a.css'), [
      '.a { margin-bottom: 16px; }',
      '.b { padding-top: 16px; }',
      '.c { margin-inline-start: 16px; }',
      '.d { top: 16px; }',
      '',
    ].join('\n'));
    const profile = {
      styling: { tokenSource: [] },
      tokens: {
        spacing: { '--s1': '4px', '--s2': '17px', '--s3': '32px' },
        radius: { '--r1': '16px', '--r2': '20px', '--r3': '28px' },
      },
    };
    const { findings } = scanRepo(root, profile, {});
    assert.equal(findings.length, 4);
    for (const finding of findings) {
      assert.equal(finding.nearestToken, '--s2', `${finding.file} took a radius token`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an unusable-scale suppression carries its reason', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-reason-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/Thing.tsx'), "const s = { padding: '17px' };\n");
    const profile = { styling: { tokenSource: [] }, tokens: { spacing: { '--a': '8px', '--b': '16px' } } };
    const { suppressed } = scanRepo(root, profile, {});
    assert.equal(suppressed.length, 1);
    assert.equal(suppressed[0].reason, 'unusable-scale');
    assert.deepEqual(suppressed[0].groups, ['spacing']);
    assert.equal(suppressed[0].distinctValues, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a duration against an empty motion group suppresses as unusable-scale', () => {
  // A transition hints `motion`. A profile with no motion tokens yields
  // an empty candidate set — today's behaviour, and the refactor must keep it.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-motion-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/Thing.tsx'), "const t = { transition: '220ms' };\n");
    const profile = { styling: { tokenSource: [] }, tokens: {} };
    const { findings, suppressed } = scanRepo(root, profile, {});
    assert.deepEqual(findings, []);
    assert.equal(suppressed.length, 1);
    assert.equal(suppressed[0].id, 'UX-103');
    assert.equal(suppressed[0].reason, 'unusable-scale');
    assert.deepEqual(suppressed[0].groups, ['motion']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a box-shadow offset equal to a radius token produces no finding', () => {
  // The 2026-09-22 restyle dogfood applied `--y-r` to a box-shadow offset
  // because 10px matched a 10px radius exactly. A shadow offset is not a
  // radius; the scanner must offer nothing rather than the nearest anything.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-shadow-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/Card.tsx'), "const s = { boxShadow: '0 10px 40px -10px rgba(0,0,0,0.3)' };\n");
    const profile = {
      styling: { tokenSource: [] },
      tokens: { radius: { '--r-sm': '6px', '--r': '10px', '--r-lg': '14px', '--r-xl': '20px' } },
    };
    const { findings, suppressed } = scanRepo(root, profile, {});
    assert.deepEqual(findings.filter((f) => f.kind === 'length'), []);
    // Not suppressed.length: the rgba() in the fixture is a colour with no
    // colour tokens, so it contributes its own unusable-scale entry.
    const lengthEntry = suppressed.find((x) => x.id === 'UX-102');
    assert.ok(lengthEntry, 'the shadow offsets must be reported as suppressed');
    assert.equal(lengthEntry.reason, 'no-context');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a border width produces no finding', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-border-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/Dot.tsx'), '<div className="border-[2px]" />\n');
    const profile = {
      styling: { tokenSource: [] },
      tokens: { radius: { '--a': '2px', '--b': '6px', '--c': '10px', '--d': '14px' } },
    };
    const { findings } = scanRepo(root, profile, {});
    assert.deepEqual(findings.filter((f) => f.kind === 'length'), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a hinted length against an unusable scale suppresses as unusable-scale, not no-context', () => {
  // Both reasons are live at once here. The context WAS identified; the scale
  // was the problem, and the report should say so.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-both-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/Thing.tsx'), "const s = { padding: '17px' };\n");
    const profile = { styling: { tokenSource: [] }, tokens: { spacing: { '--a': '8px', '--b': '16px' } } };
    const { suppressed } = scanRepo(root, profile, {});
    assert.equal(suppressed.length, 1);
    assert.equal(suppressed[0].reason, 'unusable-scale');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('one hinted and one unhinted length in a file yield a finding and a suppression', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-mixed-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(
      join(root, 'src/Mixed.tsx'),
      "const a = { padding: '17px' };\nconst b = { boxShadow: '0 11px 0 rgba(0,0,0,0.2)' };\n",
    );
    const profile = {
      styling: { tokenSource: [] },
      tokens: { spacing: { '--s1': '4px', '--s2': '8px', '--s3': '16px', '--s4': '24px' } },
    };
    const { findings, suppressed } = scanRepo(root, profile, {});
    const lengths = findings.filter((f) => f.kind === 'length');
    assert.equal(lengths.length, 1);
    assert.equal(lengths[0].line, 1);
    const lengthEntry = suppressed.find((x) => x.id === 'UX-102');
    assert.ok(lengthEntry);
    assert.equal(lengthEntry.reason, 'no-context');
    assert.equal(lengthEntry.count, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('colours match their group with no hint, and durations with a motion one', () => {
  // The obvious wrong implementation fails closed on a null hint for every
  // kind, which silently disables UX-101 altogether. Durations do fail
  // closed now, so theirs is written where a duration is actually used.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-kinds-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/K.tsx'), "const c = '#3b7d4f';\nconst t = { transition: '220ms' };\n");
    const profile = {
      styling: { tokenSource: [] },
      tokens: {
        color: { '--c1': '#3b7d4e', '--c2': '#ffffff', '--c3': '#000000', '--c4': '#888888' },
        motion: { '--m1': '150ms', '--m2': '200ms', '--m3': '300ms', '--m4': '500ms' },
      },
    };
    const { findings } = scanRepo(root, profile, {});
    assert.deepEqual(findings.map((f) => f.id).sort(), ['UX-101', 'UX-103']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('no-context suppressions tally once with a count across files', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-tally-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/A.tsx'), "const a = { boxShadow: '0 11px 0 #000' };\n");
    writeFileSync(join(root, 'src/B.tsx'), "const b = { boxShadow: '0 13px 0 #000' };\n");
    const profile = {
      styling: { tokenSource: [] },
      tokens: { radius: { '--a': '2px', '--b': '6px', '--c': '10px', '--d': '14px' } },
    };
    const { suppressed } = scanRepo(root, profile, {});
    const lengthEntry = suppressed.find((x) => x.id === 'UX-102');
    assert.ok(lengthEntry);
    assert.equal(lengthEntry.reason, 'no-context');
    assert.equal(lengthEntry.count, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// The three tests below share one fixture shape, borrowed from the longhand
// test above: every literal is 16px, the radius group holds 16px exactly and
// the spacing group holds 17px nearby. An unhinted literal therefore takes
// the radius token on numeric distance alone, so "took --s2" is evidence the
// hint steered the search rather than arithmetic.
// Every group holds a step at 17px. A finding that names the wrong token is
// therefore a finding that took the wrong group — the assertion is about
// which scale the hint selected, never about which number is nearest.
const HINT_FIXTURE_PROFILE = {
  styling: { tokenSource: [] },
  tokens: {
    spacing: { '--s1': '4px', '--s2': '17px', '--s3': '32px' },
    sizing: { '--w1': '4px', '--w2': '17px', '--w3': '32px' },
    radius: { '--r1': '16px', '--r2': '20px', '--r3': '28px' },
    type: { '--t1': '17px', '--t2': '20px', '--t3': '24px' },
  },
};

test('camelCase property spellings carry the hint their kebab form does', () => {
  // A style object written in JS spells the property paddingTop, not
  // padding-top. The kebab list held 43 longhands and not one camelCase
  // compound, so every one of these was unhinted — and since the scanner
  // began failing closed, unhinted means no check at all rather than a
  // sloppy one. borderRadius and fontSize worked only because someone had
  // hand-added their hyphen-stripped spellings to those two lists.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-camel-'));
  try {
    writeFileSync(join(root, 'a.tsx'), [
      "const a = { paddingTop: '16px' };",
      "const b = { marginBottom: '16px' };",
      "const c = { minWidth: '16px' };",
      "const d = { rowGap: '16px' };",
      "const e = { insetInlineStart: '16px' };",
      '',
    ].join('\n'));
    const { findings } = scanRepo(root, HINT_FIXTURE_PROFILE, {});
    assert.equal(findings.length, 5);
    // minWidth is a dimension and takes the sizing scale; the other four are
    // gaps. Both groups hold a 17px step, so the token name is the only
    // thing that says which one the spelling resolved to.
    const expected = { 3: '--w2' };
    for (const finding of findings) {
      const token = expected[finding.line] ?? '--s2';
      assert.equal(finding.nearestToken, token, `${finding.value} on line ${finding.line} took the wrong group`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('kebab type properties carry the type hint their camelCase form does', () => {
  // The same trap, pointing the other way: the type list held `lineheight`
  // and `letterspacing` but never `line-height` or `letter-spacing`, so the
  // spellings a stylesheet actually uses went unhinted. Nine literals in the
  // dogfood target.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-kebab-type-'));
  try {
    writeFileSync(join(root, 'a.css'), [
      '.a { line-height: 16px; }',
      '.b { letter-spacing: 16px; }',
      '',
    ].join('\n'));
    const { findings } = scanRepo(root, HINT_FIXTURE_PROFILE, {});
    assert.equal(findings.length, 2);
    for (const finding of findings) {
      assert.equal(finding.nearestToken, '--t1', `line ${finding.line} did not take a type token`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an arithmetic wrapper passes the property hint through to its operands', () => {
  // `calc(100% - 16px)` subtracts a gutter from a container: the 16px is
  // that property's value, exactly as a shorthand's later values are.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-calc-'));
  try {
    writeFileSync(join(root, 'a.css'), [
      '.a { width: calc(100% - 16px); }',
      '.b { padding: calc(16px + 1rem); }',
      '.c { max-width: min(100%, 16px); }',
      '.d { margin-top: clamp(16px, 2%, 2rem); }',
      '',
    ].join('\n'));
    const { findings } = scanRepo(root, HINT_FIXTURE_PROFILE, {});
    // Six, not four: `calc(16px + 1rem)` and `clamp(16px, 2%, 4rem)` each
    // hold a second length, and those later operands keep the hint too —
    // the same rule that carries a shorthand's later values.
    assert.equal(findings.length, 6);
    for (const finding of findings) {
      // The subject is which GROUP the hint steered the search to, not which
      // step of it won: 2rem is nearest the third step and 16px the second,
      // and both are the right kind of answer. Only a radius token is wrong.
      // Lines 1 and 3 are `width` and `max-width` — dimensions, so they take
      // the sizing scale; lines 2 and 4 are padding and margin.
      const prefix = finding.line === 1 || finding.line === 3 ? 'w' : 's';
      assert.match(
        finding.nearestToken ?? 'none',
        new RegExp(`^--${prefix}[123]$`),
        `line ${finding.line} (${finding.value}) did not take a ${prefix === 'w' ? 'sizing' : 'spacing'} token`,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('viewport arithmetic inside a wrapper gets no hint at all', () => {
  // `calc(100vh - 56px)` is layout math: the 56px is a header height, not a
  // step on the spacing scale, and offering it a spacing token that happens
  // to match numerically is the mistake the fail-closed change exists to
  // prevent. A viewport unit anywhere in the expression breaks the span
  // between the property and the literal, so the literal falls out unhinted.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-viewport-'));
  try {
    writeFileSync(join(root, 'a.css'), [
      '.a { height: calc(100vh - 16px); }',
      '.b { width: calc(100vw - 16px); }',
      '.c { max-height: min(100dvh, 16px); }',
      '',
    ].join('\n'));
    const { findings, suppressed } = scanRepo(root, HINT_FIXTURE_PROFILE, {});
    assert.equal(findings.length, 0, 'a viewport-relative length was offered a token');
    const noContext = suppressed.find((s) => s.id === 'UX-102' && s.reason === 'no-context');
    assert.equal(noContext.count, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a wrapper under an unlisted property stays fail-closed', () => {
  // The gate is the property, not the function. filter, transform and
  // box-shadow are in no hint list, so their lengths keep getting nothing —
  // these are the exact shapes restyle defect 5 wrote radius tokens into.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-unlisted-'));
  try {
    writeFileSync(join(root, 'a.css'), [
      '.a { filter: blur(16px); }',
      '.b { transform: translateY(16px); }',
      '.c { box-shadow: 0 16px 0 red; }',
      '',
    ].join('\n'));
    const { findings, suppressed } = scanRepo(root, HINT_FIXTURE_PROFILE, {});
    assert.equal(findings.length, 0, 'an unlisted property was offered a token');
    const noContext = suppressed.find((s) => s.id === 'UX-102' && s.reason === 'no-context');
    assert.equal(noContext.count, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an arithmetic wrapper inside a Tailwind arbitrary value carries the hint', () => {
  // `w-[calc(100%-2rem)]` is the same expression as `width: calc(100% - 2rem)`
  // written in the syntax a Tailwind repo actually uses, and the dogfood
  // target holds seven of them. Covering the CSS spelling and not this one
  // would rebuild, in a new place, the half-covered-property trap this
  // change exists to remove.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-tw-calc-'));
  try {
    writeFileSync(join(root, 'a.tsx'), [
      'const b = <div className="max-w-[min(100%,16px)]" />;',
      'const c = <div className="h-[calc(100vh-16px)]" />;',
      '',
    ].join('\n'));
    const { findings, suppressed } = scanRepo(root, HINT_FIXTURE_PROFILE, {});
    // One finding, from the min() line. The `h-[calc(100vh-16px)]` line
    // contributes a suppression instead: its operand now lexes — the
    // operator rule sees the minus for what it is — and the viewport rule
    // then refuses it a hint. Until that rule landed this expression held no
    // literal at all, and the refusal happened one step earlier, by
    // accident, in the lexer.
    assert.equal(findings.length, 1);
    assert.equal(findings[0].value, '16px');
    assert.equal(findings[0].nearestToken, '--w2', 'the bracket wrapper did not carry the sizing hint');
    assert.deepEqual(suppressed, [{ id: 'UX-102', reason: 'no-context', kind: 'length', count: 1 }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Tailwind's spaceless subtraction lexes its operand as a positive length", () => {
  // Tailwind's arbitrary values forbid whitespace, so `w-[calc(100%-16px)]`
  // is how a gutter is actually written — and the minus is an operator, not
  // a sign. Reading it as the negative length `-16px` made the wrapper rule
  // inert for the only spelling this syntax permits: no positive token can
  // ever match a negative literal, so the hint arrived and had nothing to
  // land on.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-tw-neg-'));
  try {
    writeFileSync(join(root, 'a.tsx'), ['const a = <div className="w-[calc(100%-16px)]" />;', ''].join('\n'));
    const { findings } = scanRepo(root, HINT_FIXTURE_PROFILE, {});
    assert.equal(findings.length, 1);
    assert.equal(findings[0].value, '16px');
    assert.equal(findings[0].nearestToken, '--w2');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('spaceless viewport arithmetic lexes its operand and still gets no hint', () => {
  // The other half of the same spelling. Before the operator rule these
  // expressions produced no literal at all — `-16px` was rejected after the
  // `h`, and `16px` was rejected after the `-` — so the viewport rule this
  // repository's own code was written for had never once run against it.
  // Now the operand lexes, reaches the hint table, and is refused there,
  // which is where the refusal belongs: a header height subtracted from the
  // viewport is layout arithmetic, not a step on the spacing scale.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-tw-viewport-'));
  try {
    writeFileSync(join(root, 'a.tsx'), [
      'const a = <div className="h-[calc(100vh-16px)]" />;',
      'const b = <div className="max-w-[calc(100vw-16px)]" />;',
      '',
    ].join('\n'));
    const { findings, suppressed } = scanRepo(root, HINT_FIXTURE_PROFILE, {});
    assert.equal(findings.length, 0, 'a viewport-relative length was offered a token');
    const noContext = suppressed.find((s) => s.id === 'UX-102' && s.reason === 'no-context');
    assert.equal(noContext.count, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a genuine negative length still lexes as negative', () => {
  // The operator rule must not swallow real negative values. A sign sits
  // after a space, '(', ',', ':' or '['; an operator sits between the end of
  // one value and the start of another. These two lines are the shapes a
  // negative margin and a centring transform actually take.
  const found = findLiterals([
    'margin: 0 -16px;',
    'transform: translate(-50%, -16px);',
    '',
  ].join('\n'));
  assert.deepEqual(found, [
    { line: 1, value: '-16px', kind: 'length' },
    { line: 2, value: '-16px', kind: 'length' },
  ]);
});

test('normalising an operator leaves every column pointing at the real literal', () => {
  // The operator is replaced by a space, one character for one, precisely so
  // the offsets reported downstream stay offsets into the line as written.
  // A reader who opens the file at the reported column has to land on the
  // literal, not one character to either side of it.
  const line = 'const a = <div className="w-[calc(100%-16px)]" />;';
  const found = findLiteralsAt(`${line}\n`);
  assert.deepEqual(found, [{ line: 1, column: line.indexOf('16px') + 1, value: '16px', kind: 'length' }]);
});

test('a hyphen between two numbers invents no literal', () => {
  // The rule rewrites a hyphen only when a number starts right after it, so
  // a date and a hyphen-joined class name are both left alone — and neither
  // holds a unit for a number to attach to, so neither may produce a length.
  assert.deepEqual(findLiterals('const d = "2024-01-02";\nconst c = "p-2em";\n'), []);
});

test("spaceless addition lexes its operand without the operator's sign", () => {
  // `+` is the same case as `-` and would otherwise be reported as the value
  // "+16px" — a string no design system contains and no reader would search
  // their stylesheet for.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-tw-plus-'));
  try {
    writeFileSync(join(root, 'a.tsx'), ['const a = <div className="w-[calc(100%+16px)]" />;', ''].join('\n'));
    const { findings } = scanRepo(root, HINT_FIXTURE_PROFILE, {});
    assert.equal(findings.length, 1);
    assert.equal(findings[0].value, '16px');
    assert.equal(findings[0].nearestToken, '--w2');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// A profile whose spacing group is a pair, not a scale — the shape four of
// four repositories dogfooded so far actually have. Every literal below is
// suppressed; the question these tests ask is what the suppression carries.
const THIN_SCALE_PROFILE = {
  styling: { tokenSource: [] },
  tokens: {
    spacing: { '--s1': '4px', '--s2': '4px', '--s3': '8px' },
    radius: {},
    type: {},
  },
};

test('an unusable group keeps the literals it suppressed, most used first', () => {
  // Throwing them away is what made the suppression line unactionable: it
  // told a reader their spacing scale is too thin and then withheld the only
  // evidence of what a real one would contain. `16px` and `1rem` stay
  // separate rows rather than being merged into pixels — a repository
  // writing both is saying something, and merging it away would hide it.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-dist-'));
  try {
    writeFileSync(join(root, 'a.css'), [
      '.a { padding: 24px; }',
      '.b { padding: 24px; }',
      '.c { padding: 24px; }',
      '.d { margin: 1rem; }',
      '.e { margin: 1rem; }',
      '.f { gap: 40px; }',
      '.g { gap: 8px; }',
      '',
    ].join('\n'));
    const { suppressed } = scanRepo(root, THIN_SCALE_PROFILE, {});
    const entry = suppressed.find((s) => s.reason === 'unusable-scale');
    assert.equal(entry.count, 7);
    assert.equal(entry.distinctLiterals, 4);
    // Ties break by length ascending, so 8px precedes 40px: a reader
    // scanning the tail of the list reads a scale, not an arbitrary order.
    assert.deepEqual(entry.values, [
      { value: '24px', count: 3 },
      { value: '1rem', count: 2 },
      { value: '8px', count: 1 },
      { value: '40px', count: 1 },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the kept literals stop at twelve, and the entry says how many there were', () => {
  // A report is read, not queried. Twelve rows is enough to see the shape of
  // an implicit scale; the count is what tells a reader the list was cut.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-dist-cap-'));
  try {
    const lines = [];
    for (let i = 1; i <= 15; i += 1) lines.push(`.c${i} { padding: ${i * 3}px; }`);
    writeFileSync(join(root, 'a.css'), `${lines.join('\n')}\n`);
    const { suppressed } = scanRepo(root, THIN_SCALE_PROFILE, {});
    const entry = suppressed.find((s) => s.reason === 'unusable-scale');
    assert.equal(entry.count, 15);
    assert.equal(entry.distinctLiterals, 15);
    assert.equal(entry.values.length, 12);
    assert.deepEqual(entry.values[0], { value: '3px', count: 1 });
    assert.deepEqual(entry.values[11], { value: '36px', count: 1 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a no-context suppression carries no literals', () => {
  // Those literals have no group at all, so they are not raw material for
  // any one scale. Listing them under a group heading would assert a
  // membership the scanner deliberately refused to guess.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-dist-none-'));
  try {
    writeFileSync(join(root, 'a.css'), ['.a { filter: blur(16px); }', ''].join('\n'));
    const { suppressed } = scanRepo(root, THIN_SCALE_PROFILE, {});
    const entry = suppressed.find((s) => s.reason === 'no-context');
    assert.equal(entry.count, 1);
    assert.equal(entry.values, undefined);
    assert.equal(entry.distinctLiterals, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// A width is not a gap. `max-w-[1184px]` is a page container, `mt-[24px]` is
// a step on a spacing scale, and until now both carried the hint `spacing`
// and competed for the same tokens. Measured across four repositories, 27%
// to 63% of every spacing-hinted length was a width or a height — in
// project-abhaya the suppressed "spacing" distribution was led by `1184px`
// and `1440px`, two container widths, which is the evidence a reader would
// have built a spacing scale out of.
const SIZING_FIXTURE_PROFILE = {
  styling: { tokenSource: [] },
  tokens: {
    spacing: { '--s1': '4px', '--s2': '24px', '--s3': '32px' },
    sizing: { '--w1': '320px', '--w2': '640px', '--w3': '1184px' },
    radius: {},
    type: {},
  },
};

test('a width literal is matched against the sizing scale, not the spacing scale', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-sizing-'));
  try {
    writeFileSync(join(root, 'a.tsx'), [
      'const a = <div className="max-w-[1180px]" />;',
      'const b = <div style={{ maxWidth: 1180 }} />;',
      'const c = <div className="mt-[25px]" />;',
      '',
    ].join('\n'));
    const { findings } = scanRepo(root, SIZING_FIXTURE_PROFILE, {});
    const width = findings.find((f) => f.value === '1180px');
    assert.ok(width, 'the width literal produced no finding at all');
    assert.equal(width.nearestToken, '--w3', 'a container width was not offered the sizing scale');
    const gap = findings.find((f) => f.value === '25px');
    assert.equal(gap.nearestToken, '--s2', 'a margin stopped being spacing');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Every UX-102 finding this scanner has ever emitted resolved to a mode
// titled "Hard-coded spacing value bypasses the spacing scale". Measured
// across four repositories, 403 of 403 of them came from the `type` or
// `radius` scale and not one from spacing — the group was computed to pick
// the candidate tokens and then dropped on the floor. Carrying it on the
// finding is what lets the row, and everything downstream, say which scale
// the literal was actually measured against.
test('a finding records the token group its literal was measured against', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-group-'));
  try {
    writeFileSync(join(root, 'a.css'), [
      '.a { font-size: 13px; }',
      '.b { padding: 13px; }',
      '.c { width: 13px; }',
      '.d { border-radius: 13px; }',
      '',
    ].join('\n'));
    const { findings } = scanRepo(root, HINT_FIXTURE_PROFILE, {});
    assert.deepEqual(
      findings.map((f) => [f.line, f.group]),
      [[1, 'type'], [2, 'spacing'], [3, 'sizing'], [4, 'radius']],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a colour and a duration finding record their own single group', () => {
  // These two never had a hint and never competed for a scale, but a
  // consumer reading `group` should not have to special-case them out.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-group2-'));
  try {
    writeFileSync(join(root, 'a.css'), [
      '.a { color: #123457; }',
      '.b { transition: 181ms; }',
      '',
    ].join('\n'));
    const { findings } = scanRepo(root, {
      styling: { tokenSource: [] },
      tokens: {
        color: { '--c1': '#123456', '--c2': '#654321', '--c3': '#abcdef' },
        motion: { '--m1': '150ms', '--m2': '180ms', '--m3': '300ms' },
      },
    }, {});
    assert.deepEqual(findings.map((f) => f.group), ['color', 'motion']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Each length scale reports under its own mode. A container width filed as
// UX-102 read as "a spacing value", and a mode broad enough to cover widths,
// corners and type at once could say nothing specific about any of them.
test('a length finding takes the mode of the scale it was measured against', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-group-id-'));
  try {
    writeFileSync(join(root, 'a.css'), [
      '.a { padding: 18px; }',
      '.b { max-width: 18px; }',
      '.c { border-radius: 21px; }',
      '.d { font-size: 21px; }',
      '',
    ].join('\n'));
    const { findings } = scanRepo(root, HINT_FIXTURE_PROFILE, {});
    assert.deepEqual(
      findings.map((f) => [f.group, f.id]),
      [['spacing', 'UX-102'], ['sizing', 'UX-121'], ['radius', 'UX-122'], ['type', 'UX-123']],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an unusable scale suppresses under that scale\'s own mode', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-group-sup-'));
  try {
    writeFileSync(join(root, 'a.css'), '.a { width: 18px; border-radius: 3px; font-size: 13px; }\n');
    const { suppressed } = scanRepo(root, { styling: { tokenSource: [] }, tokens: {} }, {});
    assert.deepEqual(
      suppressed.map((s) => [s.groups.join(), s.id]).sort(),
      [['radius', 'UX-122'], ['sizing', 'UX-121'], ['type', 'UX-123']],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const MOTION_PROFILE = {
  styling: { tokenSource: [] },
  tokens: { motion: { '--m1': '150ms', '--m2': '200ms', '--m3': '300ms' } },
};

// Every one of these came from a real repository's motion distribution.
test('a duration-shaped value outside any motion context is not measured', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-motion-ctx-'));
  try {
    writeFileSync(join(root, 'a.spec.ts'), [
      "it('404s rather than 500s for an id that is not a member', async () => {});",
      "it('keeps the full 3s drain window in production', async () => {});",
      "expect(() => validateEnv({ WEBHOOK_TIMEOUT: '10s' })).toThrow();",
      "const bio = 'he began in student politics in the early 2060s';",
      '',
    ].join('\n'));
    const { findings, suppressed } = scanRepo(root, MOTION_PROFILE, {});
    assert.deepEqual(findings, []);
    assert.deepEqual(suppressed, [{ id: 'UX-103', reason: 'no-context', kind: 'time', count: 5 }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a duration is measured wherever the code says it is one', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-motion-ok-'));
  try {
    writeFileSync(join(root, 'a.css'), [
      '.a { transition: all 0.25s; }',
      '.b {',
      '  transition:',
      '    color 251ms ease,',
      '    transform 252ms;',
      '}',
      '.c { animation: spin 253ms linear infinite; }',
      '',
    ].join('\n'));
    writeFileSync(join(root, 'b.tsx'), [
      "const FADE_DURATION = '254ms';",
      "const nav = open ? 'left 255ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none';",
      'const d = <div className="duration-[256ms] [animation-delay:257ms]" />;',
      "const s = { transitionDuration: '258ms' };",
      '',
    ].join('\n'));
    const { findings, suppressed } = scanRepo(root, MOTION_PROFILE, {});
    assert.deepEqual(findings.map((f) => f.value).sort(),
      ['0.25s', '251ms', '252ms', '253ms', '254ms', '255ms', '256ms', '257ms', '258ms']);
    assert.ok(findings.every((f) => f.id === 'UX-103' && f.group === 'motion'));
    assert.deepEqual(suppressed, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a transition earlier on the line does not vouch for a later declaration', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-motion-leak-'));
  try {
    writeFileSync(join(root, 'a.ts'), "const a = { transition: '200ms' }; log('retry in 5s');\n");
    const { findings, suppressed } = scanRepo(root, MOTION_PROFILE, {});
    assert.deepEqual(findings.map((f) => f.value), ['200ms']);
    assert.equal(suppressed[0].count, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// A codebase whose container tokens are named `--wrap-max` has a sizing
// scale the classifier cannot see. The suppression used to say "0 distinct
// values" and stop; now it names the tokens that might be it.
test('a sizing suppression names the spacing tokens filed there by value alone', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-unclaimed-'));
  try {
    writeFileSync(join(root, 'a.css'), '.a { max-width: 1184px; }\n');
    const profile = {
      styling: { tokenSource: [] },
      tokens: { spacing: { '--space-1': '4px', '--wrap-max': '1200px', '--shell': '960px' } },
    };
    const { suppressed } = scanRepo(root, profile, {});
    const sizing = suppressed.find((s) => s.id === 'UX-121');
    assert.deepEqual(sizing.unclaimedTokens, ['--shell', '--wrap-max']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a sizing suppression with nothing misfiled carries no unclaimed list', () => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-unclaimed-none-'));
  try {
    writeFileSync(join(root, 'a.css'), '.a { max-width: 1184px; }\n');
    const profile = { styling: { tokenSource: [] }, tokens: { spacing: { '--space-1': '4px' } } };
    const { suppressed } = scanRepo(root, profile, {});
    assert.equal('unclaimedTokens' in suppressed.find((s) => s.id === 'UX-121'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
