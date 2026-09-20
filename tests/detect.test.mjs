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

test('readManifest returns null for a missing package.json', () => {
  const result = readManifest('/tmp/nonexistent-dir-' + Date.now());
  assert.equal(result, null);
});

test('readManifest returns null for malformed JSON', async () => {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const dir = `/tmp/malformed-pkg-${Date.now()}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/package.json`, '{ "name": "x", }');
  try {
    const result = readManifest(dir);
    assert.equal(result, null);
  } finally {
    await import('node:fs/promises').then(m => m.rm(dir, { recursive: true, force: true }));
  }
});

test('detectStyling gracefully handles directories with no stylesheets', async () => {
  const { mkdir } = await import('node:fs/promises');
  const dir = `/tmp/no-css-${Date.now()}`;
  await mkdir(dir, { recursive: true });
  try {
    const styling = detectStyling(dir, {});
    assert.equal(styling.system, null);
    assert.deepEqual(styling.tokenSource, []);
    assert.equal(styling.tokenSyntax, null);
  } finally {
    await import('node:fs/promises').then(m => m.rm(dir, { recursive: true, force: true }));
  }
});

test('detectComponents gracefully handles directories with no components', async () => {
  const { mkdir } = await import('node:fs/promises');
  const dir = `/tmp/no-components-${Date.now()}`;
  await mkdir(dir, { recursive: true });
  try {
    const components = detectComponents(dir, {});
    assert.equal(components.dir, null);
    assert.equal(components.variantMechanism, 'props');
  } finally {
    await import('node:fs/promises').then(m => m.rm(dir, { recursive: true, force: true }));
  }
});

test('prefers densest directory over small /ui directory when outside band', async () => {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const dir = `/tmp/ui-vs-dense-${Date.now()}`;
  await mkdir(`${dir}/src/components/ui`, { recursive: true });
  await mkdir(`${dir}/src/components`, { recursive: true });
  await writeFile(`${dir}/src/components/ui/small.tsx`, 'export const Small = () => null;');
  await writeFile(`${dir}/src/components/comp1.tsx`, 'export const C1 = () => null;');
  await writeFile(`${dir}/src/components/comp2.tsx`, 'export const C2 = () => null;');
  await writeFile(`${dir}/src/components/comp3.tsx`, 'export const C3 = () => null;');
  await writeFile(`${dir}/src/components/comp4.tsx`, 'export const C4 = () => null;');
  await writeFile(`${dir}/src/components/comp5.tsx`, 'export const C5 = () => null;');
  try {
    const components = detectComponents(dir, {});
    assert.equal(components.dir, 'src/components', 'dense non-ui directory should win over small ui directory outside band');
  } finally {
    await import('node:fs/promises').then(m => m.rm(dir, { recursive: true, force: true }));
  }
});

test('prefers /ui directory when within band of densest', async () => {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const dir = `/tmp/ui-in-band-${Date.now()}`;
  await mkdir(`${dir}/src/components/ui`, { recursive: true });
  await mkdir(`${dir}/src/components`, { recursive: true });
  await writeFile(`${dir}/src/components/ui/button.tsx`, 'export const Button = () => null;');
  await writeFile(`${dir}/src/components/ui/card.tsx`, 'export const Card = () => null;');
  await writeFile(`${dir}/src/components/comp1.tsx`, 'export const C1 = () => null;');
  await writeFile(`${dir}/src/components/comp2.tsx`, 'export const C2 = () => null;');
  try {
    const components = detectComponents(dir, {});
    assert.equal(components.dir, 'src/components/ui', '/ui should win when within band');
  } finally {
    await import('node:fs/promises').then(m => m.rm(dir, { recursive: true, force: true }));
  }
});

test('detectStyling includes all stylesheets with 3+ properties in tokenSource', async () => {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const dir = `/tmp/multi-tokens-${Date.now()}`;
  await mkdir(`${dir}/src/styles`, { recursive: true });
  await writeFile(`${dir}/src/styles/colors.css`, `
    :root {
      --color-primary: #000;
      --color-secondary: #fff;
      --color-tertiary: #ccc;
    }
  `);
  await writeFile(`${dir}/src/styles/spacing.css`, `
    :root {
      --spacing-sm: 4px;
      --spacing-md: 8px;
      --spacing-lg: 16px;
    }
  `);
  try {
    const styling = detectStyling(dir, {});
    assert.equal(styling.tokenSource.length, 2, 'both stylesheets should be in tokenSource');
    assert.ok(styling.tokenSource.includes('src/styles/colors.css'));
    assert.ok(styling.tokenSource.includes('src/styles/spacing.css'));
    assert.equal(styling.tokenSyntax, ':root', 'tokenSyntax should be derived from first entry');
  } finally {
    await import('node:fs/promises').then(m => m.rm(dir, { recursive: true, force: true }));
  }
});
