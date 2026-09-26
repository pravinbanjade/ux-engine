import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractBlocks, extractCustomProperties, categorizeToken, groupTokens, isUsableScale, MIN_SCALE_VALUES, nameKind } from '../scripts/lib/tokens.mjs';

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
  assert.equal(Object.keys(props).length, 11);
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
  assert.deepEqual(Object.keys(grouped.color), ['--color-primary', '--color-surface', '--color-danger']);
  assert.deepEqual(Object.keys(grouped.spacing), ['--space-2', '--space-4', '--space-6']);
  assert.deepEqual(Object.keys(grouped.motion), ['--duration-fast', '--duration-slow', '--duration-slower']);
});

test('extractCustomProperties captures final declaration without trailing semicolon', () => {
  const props = extractCustomProperties(':root{ --a: 1px; --b: 2px }');
  assert.deepEqual(props, { '--a': '1px', '--b': '2px' });
});

test('categorizeToken handles border-* names correctly', () => {
  assert.equal(categorizeToken('--border-radius', '0.5rem'), 'radius');
  // A border width is a line thickness. It has no group of its own and
  // reaches `spacing` by the value rule, not by a name rule — but it is
  // deliberately kept out of `sizing`, where a 1px stroke would be measured
  // against a 640px container scale.
  assert.equal(categorizeToken('--border-width', '1px'), 'spacing');
  assert.equal(categorizeToken('--ring-width', '2px'), 'spacing');
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

test('a container or breakpoint token is sizing, not spacing', () => {
  // The scanner now measures widths against a `sizing` scale. If the tokens
  // a person adds in response land in `spacing`, that scale can never exist
  // and the suppression telling them to build one is a dead end: the report
  // says "0 distinct values" forever however many container tokens they
  // write. The name rule is what closes that loop.
  assert.equal(categorizeToken('--container-md', '768px'), 'sizing');
  assert.equal(categorizeToken('--breakpoint-lg', '1024px'), 'sizing');
  assert.equal(categorizeToken('--screen-xl', '1280px'), 'sizing');
  assert.equal(categorizeToken('--max-width-prose', '65ch'), 'sizing');
  assert.equal(categorizeToken('--avatar-height', '40px'), 'sizing');
});

test('a gap or inset token is still spacing', () => {
  // The word `size` used to live in the spacing rule, which is why the
  // sizing rule has to be read first. Everything the spacing rule owned on
  // its own merits keeps it.
  assert.equal(categorizeToken('--spacing-4', '16px'), 'spacing');
  assert.equal(categorizeToken('--gap-sm', '8px'), 'spacing');
  assert.equal(categorizeToken('--inset-1', '4px'), 'spacing');
});

test('groupTokens gives sizing a group of its own', () => {
  const grouped = groupTokens({ '--container-md': '768px', '--spacing-4': '16px' });
  assert.deepEqual(grouped.sizing, { '--container-md': '768px' });
  assert.deepEqual(grouped.spacing, { '--spacing-4': '16px' });
});

test('a line-height or letter-spacing token is typography', () => {
  // These two are the reason the sizing rule cannot simply claim every name
  // containing "height": `--line-height` is a typographic ratio, not a
  // dimension. They were already misfiled — `--letter-spacing` matched the
  // spacing rule's "spacing" and `--line-height` matched nothing at all —
  // and the scanner's own hint table has always read both as type, so this
  // is the categoriser catching up to it rather than a new opinion.
  assert.equal(categorizeToken('--line-height-tight', '1.25'), 'type');
  assert.equal(categorizeToken('--letter-spacing-wide', '0.05em'), 'type');
});

// Layout vocabulary names a dimension without saying width. It is weaker
// than the sizing rule's own words, so it yields to a spacing word in the
// name and to a value that is not a length.
test('layout and column tokens with a length value are sizing', () => {
  assert.equal(categorizeToken('--layout-md', '1184px'), 'sizing');
  assert.equal(categorizeToken('--col-8', '66.666%'), 'sizing');
  assert.equal(categorizeToken('--columns-narrow', '40rem'), 'sizing');
  assert.equal(categorizeToken('--measure', '65ch'), 'other');
});

test('layout words yield to a spacing word and to a non-length value', () => {
  assert.equal(categorizeToken('--layout-gap', '24px'), 'spacing');
  assert.equal(categorizeToken('--column-gap', '16px'), 'spacing');
  assert.equal(categorizeToken('--layout-gutter', '16px'), 'spacing');
  assert.equal(categorizeToken('--grid-cols', 'repeat(12, minmax(0, 1fr))'), 'other');
  assert.equal(categorizeToken('--color-accent', '#3b7d4f'), 'color');
});

test('nameKind reports a name rule\'s group, or null when only the value decides', () => {
  assert.equal(nameKind('--space-4'), 'spacing');
  assert.equal(nameKind('--container-lg'), 'sizing');
  assert.equal(nameKind('--wrap-max'), null);
});
