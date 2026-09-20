import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readManifest, detectStyling, detectComponents, detectConventions, walkFiles } from '../scripts/lib/detect.mjs';

const fixture = (name) => fileURLToPath(new URL(`../tests/fixtures/${name}/`, import.meta.url));

test('walkFiles returns repo-relative posix paths', () => {
  const files = walkFiles(fixture('tailwind-shadcn'), ['.tsx']);
  assert.ok(files.includes('src/components/ui/button.tsx'));
  assert.ok(files.every((f) => !f.startsWith('/')));
});

test('detects tailwind v4 with an @theme token source', () => {
  const { deps } = readManifest(fixture('tailwind-shadcn'));
  const styling = detectStyling(fixture('tailwind-shadcn'), deps);
  assert.equal(styling.system, 'tailwind-v4');
  assert.equal(styling.tokenSyntax, '@theme');
  assert.deepEqual(styling.tokenSource, ['src/styles/app.css']);
  assert.equal(styling.utilityFirst, true);
});

test('detects css-modules with a :root token source', () => {
  const { deps } = readManifest(fixture('css-modules'));
  const styling = detectStyling(fixture('css-modules'), deps);
  assert.equal(styling.system, 'css-modules');
  assert.equal(styling.tokenSyntax, ':root');
  assert.deepEqual(styling.tokenSource, ['src/styles/tokens.css']);
  assert.equal(styling.utilityFirst, false);
});

test('detects css-in-js', () => {
  const { deps } = readManifest(fixture('styled-components'));
  assert.equal(detectStyling(fixture('styled-components'), deps).system, 'styled-components');
});

test('detects a shadcn component directory using cva', () => {
  const { deps } = readManifest(fixture('tailwind-shadcn'));
  const components = detectComponents(fixture('tailwind-shadcn'), deps);
  assert.equal(components.dir, 'src/components/ui');
  assert.equal(components.library, 'shadcn');
  assert.equal(components.variantMechanism, 'cva');
  assert.equal(components.primitives, 'radix');
});

test('falls back to the densest component directory', () => {
  const { deps } = readManifest(fixture('css-modules'));
  const components = detectComponents(fixture('css-modules'), deps);
  assert.equal(components.dir, 'src/components');
  assert.equal(components.library, null);
  assert.equal(components.variantMechanism, 'props');
});

test('reads conventions from the manifest', () => {
  const { deps } = readManifest(fixture('tailwind-shadcn'));
  const c = detectConventions(deps);
  assert.equal(c.framework, 'react-19');
  assert.equal(c.router, 'tanstack-router');
  assert.equal(c.testRunner, 'vitest');
  assert.equal(c.iconSet, 'lucide');
  assert.equal(c.a11yTarget, 'WCAG 2.2 AA');
});

test('conventions degrade to null rather than guessing', () => {
  const c = detectConventions({});
  assert.equal(c.framework, null);
  assert.equal(c.router, null);
  assert.equal(c.testRunner, null);
});
