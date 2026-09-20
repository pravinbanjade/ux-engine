import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractBlocks, extractCustomProperties, categorizeToken, groupTokens } from '../scripts/lib/tokens.mjs';

const tailwindCss = readFileSync(fileURLToPath(new URL('../tests/fixtures/tailwind-shadcn/src/styles/app.css', import.meta.url)), 'utf8');
const cssModulesCss = readFileSync(fileURLToPath(new URL('../tests/fixtures/css-modules/src/styles/tokens.css', import.meta.url)), 'utf8');

test('extractBlocks finds an @theme block', () => {
  const blocks = extractBlocks(tailwindCss);
  assert.equal(blocks.length, 1);
  assert.match(blocks[0], /--color-primary/);
});

test('extractBlocks finds a :root block', () => {
  assert.equal(extractBlocks(cssModulesCss).length, 1);
});

test('extractBlocks ignores properties outside a token block', () => {
  assert.deepEqual(extractBlocks('.a { --local: 1px; }'), []);
});

test('extractCustomProperties reads values verbatim', () => {
  const props = extractCustomProperties(tailwindCss);
  assert.equal(props['--color-primary'], 'oklch(0.55 0.15 150)');
  assert.equal(props['--duration-fast'], '150ms');
  assert.equal(Object.keys(props).length, 9);
});

test('categorizeToken uses the name first', () => {
  assert.equal(categorizeToken('--color-primary', 'oklch(0.55 0.15 150)'), 'color');
  assert.equal(categorizeToken('--spacing-4', '1rem'), 'spacing');
  assert.equal(categorizeToken('--radius-md', '0.5rem'), 'radius');
  assert.equal(categorizeToken('--text-base', '1rem'), 'type');
  assert.equal(categorizeToken('--duration-fast', '150ms'), 'motion');
});

test('categorizeToken falls back to the value shape', () => {
  assert.equal(categorizeToken('--brand', '#2f6f4f'), 'color');
  assert.equal(categorizeToken('--gap', '8px'), 'spacing');
  assert.equal(categorizeToken('--quick', '200ms'), 'motion');
  assert.equal(categorizeToken('--mystery', 'inherit'), 'other');
});

test('groupTokens buckets every property', () => {
  const grouped = groupTokens(extractCustomProperties(cssModulesCss));
  assert.deepEqual(Object.keys(grouped.color), ['--color-primary', '--color-surface']);
  assert.deepEqual(Object.keys(grouped.spacing), ['--space-2', '--space-4']);
  assert.deepEqual(Object.keys(grouped.motion), ['--duration-fast']);
});
