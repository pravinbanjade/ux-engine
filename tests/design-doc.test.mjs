import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildProfile } from '../scripts/lib/profile.mjs';
import { renderDesignDoc, extractExceptions } from '../scripts/lib/design-doc.mjs';

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
