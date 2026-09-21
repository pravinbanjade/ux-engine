import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractBlocks, extractCustomProperties, categorizeToken, groupTokens, isUsableScale, MIN_SCALE_VALUES } from '../scripts/lib/tokens.mjs';

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

test('extractCustomProperties captures final declaration without trailing semicolon', () => {
  const props = extractCustomProperties(':root{ --a: 1px; --b: 2px }');
  assert.deepEqual(props, { '--a': '1px', '--b': '2px' });
});

test('categorizeToken handles border-* names correctly', () => {
  assert.equal(categorizeToken('--border-radius', '0.5rem'), 'radius');
  assert.equal(categorizeToken('--border-width', '1px'), 'spacing');
  assert.equal(categorizeToken('--border-color', '#fff'), 'color');
  assert.equal(categorizeToken('--color-border', '#fff'), 'color');
});

test('groupTokens includes shadow, radius, type, and other buckets', () => {
  const props = {
    '--shadow-sm': '0 1px 2px rgba(0,0,0,0.05)',
    '--radius-lg': '12px',
    '--font-size': '16px',
    '--unknown': 'custom-value'
  };
  const grouped = groupTokens(props);
  assert.deepEqual(Object.keys(grouped.shadow), ['--shadow-sm']);
  assert.deepEqual(Object.keys(grouped.radius), ['--radius-lg']);
  assert.deepEqual(Object.keys(grouped.type), ['--font-size']);
  assert.deepEqual(Object.keys(grouped.other), ['--unknown']);
});

// A colour-shaped value wins over a name rule: '--text-dark' and '--y-text'
// both match the `text|font|leading|tracking|type` name rule, but their
// values are real colours, so they must be classified as 'color', not
// 'type' — otherwise they're invisible to colour matching in the scanner.
// '--text-base' and '--font-sans' keep the old, correct behaviour: neither
// value parses as a colour, so the name rule still decides.
test('categorizeToken classifies a colour-valued "text" token as color, not type', () => {
  assert.equal(categorizeToken('--text-dark', '#314158'), 'color');
  assert.equal(categorizeToken('--y-text', '#3a4564'), 'color');
});

test('categorizeToken still uses the name rule when the value is not a colour', () => {
  assert.equal(categorizeToken('--text-base', '1rem'), 'type');
  assert.equal(categorizeToken('--font-sans', "'Poppins', sans-serif"), 'type');
});

test('isUsableScale accepts a group with three distinct values', () => {
  assert.equal(isUsableScale({ '--a': '4px', '--b': '8px', '--c': '16px' }), true);
});

test('isUsableScale rejects a group with two distinct values', () => {
  assert.equal(isUsableScale({ '--y-r': '10px', '--y-r-lg': '14px' }), false);
});

test('isUsableScale rejects an empty group', () => {
  assert.equal(isUsableScale({}), false);
});

test('isUsableScale counts distinct values, not names', () => {
  // Three aliases of one step are one step. A repo that names the same
  // 1rem three times has no scale to snap anything to.
  assert.equal(isUsableScale({ '--a': '1rem', '--b': '1rem', '--c': '1rem' }), false);
});

test('isUsableScale tolerates a null or undefined group', () => {
  // scanRepo merges `profile.tokens[group] ?? {}`, but a hand-edited
  // profile can still hand us a null; the gate must answer false rather
  // than throw mid-scan.
  assert.equal(isUsableScale(null), false);
  assert.equal(isUsableScale(undefined), false);
});

test('MIN_SCALE_VALUES is the documented threshold', () => {
  assert.equal(MIN_SCALE_VALUES, 3);
});
