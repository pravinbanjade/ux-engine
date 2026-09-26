import { parseTokenColor } from './color.mjs';

export const TOKEN_KINDS = ['color', 'spacing', 'sizing', 'radius', 'type', 'shadow', 'motion', 'other'];

const BLOCK_START = /(?:@theme[^{]*|:root[^{]*)\{/g;

export function extractBlocks(css) {
  const blocks = [];
  BLOCK_START.lastIndex = 0;
  let match;
  while ((match = BLOCK_START.exec(css))) {
    let depth = 1;
    let i = BLOCK_START.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push(css.slice(BLOCK_START.lastIndex, i - 1));
    BLOCK_START.lastIndex = i;
  }
  return blocks;
}

export function extractCustomProperties(css) {
  const props = {};
  for (const block of extractBlocks(css)) {
    const re = /(--[A-Za-z0-9_-]+)\s*:\s*([^;}]+)(?:[;}]|$)/g;
    let m;
    while ((m = re.exec(block))) props[m[1]] = m[2].trim();
  }
  return props;
}

// Every declaration of every custom property in a stylesheet, wherever it
// sits: the base block, `.dark`, `[data-theme="dark"]`, a media query. The
// token groups above read only `:root` and `@theme`, and there the last value
// wins, so a token that is near-black in light mode and near-white in dark
// mode is recorded as whichever came last. A literal written in its place is
// the same colour in both themes; the token is not, and substituting one for
// the other changes what the element looks like in the theme nobody was
// looking at — white text on a dark button that turns near-black in light
// mode, on a light button, and disappears.
export function declaredValues(css) {
  const values = new Map();
  const re = /(--[A-Za-z0-9_-]+)\s*:\s*([^;}]+)(?=[;}])/g;
  let m;
  while ((m = re.exec(css))) {
    const value = m[2].trim().replace(/\s+/g, ' ').toLowerCase();
    if (!values.has(m[1])) values.set(m[1], new Set());
    values.get(m[1]).add(value);
  }
  return values;
}

// The names declared with more than one distinct value, sorted.
export function themedTokenNames(cssTexts) {
  const all = new Map();
  for (const css of cssTexts) {
    for (const [name, set] of declaredValues(css)) {
      if (!all.has(name)) all.set(name, new Set());
      for (const v of set) all.get(name).add(v);
    }
  }
  return [...all].filter(([, set]) => set.size > 1).map(([name]) => name).sort();
}

const NAME_RULES = [
  [/color|colour|bg|background|fg|foreground|border-color|accent|brand/, 'color'],
  [/radius|rounded/, 'radius'],
  [/shadow|elevation/, 'shadow'],
  [/duration|ease|transition|animate|motion/, 'motion'],
  // line-height and letter-spacing sit here, ahead of both rules that would
  // otherwise claim them: `--letter-spacing` matched the spacing rule's
  // "spacing" and `--line-height` would now match the sizing rule's
  // "height". Both are typographic, and the scanner's hint table has always
  // read them that way.
  [/text|font|leading|tracking|type|line-?height|letter-?spacing/, 'type'],
  // A dimension is not a gap, and the scanner no longer measures one
  // against the other. This rule is what makes the advice it gives
  // actionable: told that its sizing group holds no scale, a codebase adds
  // `--container-md` and `--breakpoint-lg`, and those have to land in
  // `sizing` or the group stays empty however many are written. It reads
  // before the spacing rule because that rule owns the bare word `size`.
  //
  // The width alternative is guarded: a border, outline, ring or stroke
  // width is a line thickness, not a box dimension, and grouping a 1px
  // border with a 640px container would measure the first against the
  // second. The scanner's hint table already refuses `border-width` for
  // exactly this reason — its property boundary excludes a preceding
  // hyphen — so the guard keeps the two tables saying the same thing.
  [/container|breakpoint|screen|viewport|\bsize\b|(?<!border-|outline-|ring-|stroke-)width|height/, 'sizing'],
  [/spacing|space|gap|size|inset/, 'spacing'],
];

// Layout vocabulary that names a dimension without saying width: a
// `--layout-md` content column or a `--col-8` grid track. These words are
// weaker than the sizing rule's own — `--layout-gap` and `--column-gap` are
// gaps, and `--grid-cols: repeat(12, 1fr)` is not a length at all — so the
// rule claims a token only when its name carries no spacing word and its
// value is a length. Anything it declines falls through exactly as before.
const LAYOUT_NAME = /layout|\bcol(?:umn)?s?\b|measure/;
const SPACING_WORD = /gap|gutter|padding|margin|space|spacing|inset/;
const LAYOUT_VALUE = /^-?\d+(\.\d+)?(px|rem|em|%)$/;

const COLOR_VALUE = /^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\()/;
const TIME_VALUE = /^\d+(\.\d+)?m?s$/;
const LENGTH_VALUE = /^-?\d+(\.\d+)?(px|rem|em)$/;

export function categorizeToken(name, value) {
  // An unambiguous colour value wins over a name rule: a token named
  // `--text` or `--y-text` whose value is a real colour (hex, rgb/rgba,
  // hsl/hsla, oklch) is a colour, not typography, even though its name
  // matches the `text|font|leading|tracking|type` rule below. Checking the
  // name first — the previous order — made every such token invisible to
  // colour matching, for no benefit: a name rule only exists to classify
  // values parseColor can't itself resolve (e.g. bare lengths, keywords),
  // so letting a real colour value settle the question first never takes a
  // correct classification away from the name rules, it only fixes the
  // cases they got wrong.
  if (parseTokenColor(value) !== null) return 'color';
  const v = String(value).trim();
  const named = nameKind(name);
  if (named) return named;
  if (LAYOUT_NAME.test(name) && !SPACING_WORD.test(name) && LAYOUT_VALUE.test(v)) return 'sizing';
  if (COLOR_VALUE.test(v)) return 'color';
  if (TIME_VALUE.test(v)) return 'motion';
  if (LENGTH_VALUE.test(v)) return 'spacing';
  return 'other';
}

// The group a token's name alone puts it in, or null when no name rule
// claims it and its value has to decide. The scanner uses the null case to
// find tokens that sit in a group on their value alone.
export function nameKind(name) {
  for (const [pattern, kind] of NAME_RULES) {
    if (pattern.test(name)) return kind;
  }
  return null;
}

export function groupTokens(props) {
  const grouped = Object.fromEntries(TOKEN_KINDS.map((k) => [k, {}]));
  for (const [name, value] of Object.entries(props)) {
    grouped[categorizeToken(name, value)][name] = value;
  }
  return grouped;
}

// Two values are a pair; three are a scale. Below this, a mode whose advice
// is "snap to the nearest step" has no steps to offer, so reporting the
// literal is noise and substituting against it is guesswork.
export const MIN_SCALE_VALUES = 3;

export function isUsableScale(candidates) {
  if (!candidates) return false;
  return new Set(Object.values(candidates)).size >= MIN_SCALE_VALUES;
}
