import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildProfile } from '../scripts/lib/profile.mjs';
import { renderDesignDoc, extractExceptions, extractUnknownSections } from '../scripts/lib/design-doc.mjs';

const fixture = (n) => fileURLToPath(new URL(`../tests/fixtures/${n}/`, import.meta.url));
const doc = renderDesignDoc(buildProfile(fixture('tailwind-shadcn'), { now: '2026-01-01T00:00:00.000Z' }));

test('renders the four required sections', () => {
  for (const heading of ['## Tokens', '## Components', '## Conventions', '## Deliberate Exceptions']) {
    assert.ok(doc.includes(heading), `missing ${heading}`);
  }
});

test('lists every token with its value and source', () => {
  assert.match(doc, /--color-primary \| `oklch\(0\.55 0\.15 150\)`/);
  assert.match(doc, /src\/styles\/app\.css/);
});

test('names the variant mechanism and component directory', () => {
  assert.match(doc, /src\/components\/ui/);
  assert.match(doc, /cva/);
});

test('an empty token group is omitted rather than rendered blank', () => {
  assert.ok(!/### Shadow/.test(doc), 'shadow group has no tokens and must be omitted');
});

test('extractExceptions preserves hand-written content', () => {
  const existing = '# Design System\n\n## Tokens\nold\n\n## Deliberate Exceptions\n- The marketing hero uses a one-off gradient; approved 2026-02.\n';
  assert.match(extractExceptions(existing), /marketing hero/);
});

test('extractExceptions returns the placeholder when the section is absent', () => {
  assert.match(extractExceptions('# Design System\n'), /None recorded/);
});

test('extractUnknownSections returns unknown sections in original order', () => {
  const doc = `# Design System

## Tokens
old

## Custom Notes
Important notes here

## Components
old

## Accessibility
WCAG 2.1 AAA target

## Conventions
old

## Deliberate Exceptions
old
`;
  const unknown = extractUnknownSections(doc);
  assert.match(unknown, /## Custom Notes/);
  assert.match(unknown, /## Accessibility/);
  assert.match(unknown, /Important notes here/);
  assert.match(unknown, /WCAG 2.1 AAA target/);
  // Verify order is preserved
  assert.ok(unknown.indexOf('Custom Notes') < unknown.indexOf('Accessibility'));
});

test('unknown sections survive a regenerate round-trip', () => {
  const profile = buildProfile(fixture('tailwind-shadcn'), { now: '2026-01-01T00:00:00.000Z' });
  const original = renderDesignDoc(profile, undefined, '## Custom Notes\n\nDo not modify.');

  // Extract and regenerate
  const unknown = extractUnknownSections(original);
  const regenerated = renderDesignDoc(profile, undefined, unknown);

  assert.match(regenerated, /## Custom Notes/);
  assert.match(regenerated, /Do not modify/);
});

test('a ## heading inside a fenced code block is not mistaken for the exceptions heading', () => {
  const doc = `# Design System

## Tokens
old

## Deliberate Exceptions
Codeblock below shows structure:
\`\`\`
## Deliberate Exceptions
{
  "note": "value"
}
\`\`\`

This is the real content.`;

  const exceptions = extractExceptions(doc);
  assert.match(exceptions, /Codeblock below/);
  assert.match(exceptions, /This is the real content/);
  // Should not include the code block's ## line as a separate section
  assert.ok(exceptions.includes('```'));
});

test('token values with pipes and backticks render as single intact rows', () => {
  const testTokens = {
    'grid-template': 'repeat(12, 1fr) | auto-fit',
    'gradient': 'linear-gradient(45deg, `color-1`, `color-2`)',
  };
  const table = renderDesignDoc({
    generatedAt: '2026-01-01',
    styling: { tokenSource: [], tokenSyntax: 'css' },
    components: { dir: null, variantMechanism: 'cva' },
    conventions: { a11yTarget: 'WCAG 2.1 AA' },
    tokens: { color: testTokens },
  }).split('\n');

  // Find the table rows (skip header rows)
  const rows = table.filter(r => r.includes('grid-template') || r.includes('gradient'));
  assert.equal(rows.length, 2, 'both tokens rendered as rows');

  const pipeRow = rows.find((r) => r.includes('grid-template'));
  assert.ok(!pipeRow.includes('\n'), `row is a single line: ${pipeRow}`);
  // GFM escapes a literal pipe inside a cell as \|, which is not a column
  // separator. Splitting on *unescaped* pipes must still yield exactly the
  // 2 real cells (3 delimiters: leading, middle, trailing).
  const unescapedPipes = (pipeRow.match(/(?<!\\)\|/g) || []).length;
  assert.equal(unescapedPipes, 3, `row has exactly 3 unescaped pipe delimiters (2 cells): ${pipeRow}`);
  assert.match(pipeRow, /auto-fit/, 'the literal pipe value survived rather than being dropped');

  const backtickRow = rows.find((r) => r.includes('gradient'));
  assert.ok(!backtickRow.includes('\n'), `row is a single line: ${backtickRow}`);
  // Internal backticks must be escaped so the outer code span (the two
  // backticks wrapping the whole value) is not closed early.
  const unescapedBackticks = (backtickRow.match(/(?<!\\)`/g) || []).length;
  assert.equal(unescapedBackticks, 2, `only the opening/closing code-span backticks are unescaped: ${backtickRow}`);
});

test('token values with newlines are collapsed to single spaces', () => {
  const testTokens = {
    'multi-line': 'linear-gradient(\n  45deg,\n  red,\n  blue\n)',
  };
  const doc = renderDesignDoc({
    generatedAt: '2026-01-01',
    styling: { tokenSource: [], tokenSyntax: 'css' },
    components: { dir: null, variantMechanism: 'cva' },
    conventions: { a11yTarget: 'WCAG 2.1 AA' },
    tokens: { color: testTokens },
  });

  // Value should be on a single line with collapsed whitespace
  assert.match(doc, /linear-gradient\( 45deg, red, blue \)/);
});

test('renderDesignDoc handles a numeric token value without throwing', () => {
  // A hand-transcribed CSS-in-JS theme object (e.g. from a JS/TS file) may
  // have numeric values like {"--spacing": 4}. String() coerces them before
  // .replace() is called, so renderDesignDoc does not crash.
  const testTokens = {
    '--z-index-modal': 1000,
    '--opacity-full': 1,
    '--scale-max': 1.5,
  };
  const doc = renderDesignDoc({
    generatedAt: '2026-01-01',
    styling: { tokenSource: [], tokenSyntax: 'js-object' },
    components: { dir: null, variantMechanism: 'cva' },
    conventions: { a11yTarget: 'WCAG 2.1 AA' },
    tokens: { other: testTokens },
  });

  // All numeric values should be rendered as strings in the table
  assert.match(doc, /--z-index-modal.*1000/);
  assert.match(doc, /--opacity-full.*1(?!\d)/);
  assert.match(doc, /--scale-max.*1\.5/);
});

test('write-design-doc.mjs CLI exits 3 when no profile exists', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'ux-engine-'));
  try {
    const result = spawnSync('node', ['scripts/write-design-doc.mjs', tmpDir], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
    });
    assert.equal(result.status, 3);
    assert.match(result.stderr, /No \.ux-engine\/profile\.json/);
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});

test('write-design-doc.mjs CLI exits 3 on a structurally invalid profile with a descriptive message', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'ux-engine-'));
  try {
    mkdirSync(join(tmpDir, '.ux-engine'), { recursive: true });
    // A profile that parses as JSON but is missing required fields
    writeFileSync(join(tmpDir, '.ux-engine/profile.json'), JSON.stringify({ version: 1, derivedFrom: [] }));

    const result = spawnSync('node', ['scripts/write-design-doc.mjs', tmpDir], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
    });

    assert.equal(result.status, 3);
    assert.match(result.stderr, /Profile is missing or has an invalid/);
    assert.equal(result.stdout, '', 'stdout must be empty on exit 3');
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});
