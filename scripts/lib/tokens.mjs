import { parseColor } from './color.mjs';

export const TOKEN_KINDS = ['color', 'spacing', 'radius', 'type', 'shadow', 'motion', 'other'];

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

const NAME_RULES = [
  [/color|colour|bg|background|fg|foreground|border-color|accent|brand/, 'color'],
  [/radius|rounded/, 'radius'],
  [/shadow|elevation/, 'shadow'],
  [/duration|ease|transition|animate|motion/, 'motion'],
  [/text|font|leading|tracking|type/, 'type'],
  [/spacing|space|gap|size|inset/, 'spacing'],
];

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
  if (parseColor(value) !== null) return 'color';
  for (const [pattern, kind] of NAME_RULES) {
    if (pattern.test(name)) return kind;
  }
  const v = String(value).trim();
  if (COLOR_VALUE.test(v)) return 'color';
  if (TIME_VALUE.test(v)) return 'motion';
  if (LENGTH_VALUE.test(v)) return 'spacing';
  return 'other';
}

export function groupTokens(props) {
  const grouped = Object.fromEntries(TOKEN_KINDS.map((k) => [k, {}]));
  for (const [name, value] of Object.entries(props)) {
    grouped[categorizeToken(name, value)][name] = value;
  }
  return grouped;
}
