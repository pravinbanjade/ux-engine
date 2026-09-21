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

test('scanRepo narrows a Tailwind v4 "size-" literal to the spacing token group', () => {
  withTempRoot((root) => {
    // Tailwind v4's `size-*` sets width and height together from one class.
    writeFileSync(join(root, 'Foo.tsx'), 'const c = "size-[10px]";\n');
    const profile = {
      styling: { tokenSource: [] },
      tokens: { radius: { '--radius': '10px' }, spacing: { '--space-3': '9px' } },
    };
    const { findings } = scanRepo(root, profile, {});
    const finding = findings.find((f) => f.value === '10px');
    assert.equal(finding.nearestToken, '--space-3');
  });
});

test('scanRepo narrows a "min-width" property literal to the spacing token group', () => {
  withTempRoot((root) => {
    writeFileSync(join(root, 'Foo.css'), '.foo { min-width: 10px; }\n');
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

test('scanRepo continues scanning other files when one file has a read error, completing the scan and reporting findings from good files', () => {
  // The try/catch structures in scanRepo ensure that a failure reading or
  // parsing one file does not interrupt the entire scan. Test this by
  // scanning a directory with one readable, good file and one file that
  // fails to read (via a restricted-permission file), confirming that the
  // skipped list is populated while findings still come back.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-scan-skip-error-'));
  try {
    writeFileSync(join(root, 'good.tsx'), 'const c = "17px";\n');
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
      tokens: { spacing: { '--space-4': '16px' } },
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
