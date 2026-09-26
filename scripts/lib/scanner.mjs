import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { walkFiles } from './detect.mjs';
import { parseColor, deltaE, parseScalar, scalarDistance } from './color.mjs';
import { isUsableScale, nameKind } from './tokens.mjs';

export const DEFAULT_THRESHOLDS = { color: 0.10, scalar: 0.15 };

const SCAN_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte', '.css'];

// A number, optionally signed, with an optional decimal part — including a
// leading-dot decimal (".5") — the same shapes color.mjs's parseScalar
// resolves. No bare/unitless form is included: an unsuffixed number is far
// too common in ordinary code to treat as a literal design value.
const NUMBER = String.raw`[+-]?(?:\d+\.\d+|\.\d+|\d+)`;
// \b doesn't work as the left boundary here: a leading-dot decimal like
// ".5rem" needs to match right after a space, but '.' and ' ' are both
// non-word characters, so there is no \w/\W transition there for \b to
// fire. (?<![\w.-]) stands in for it instead, and deliberately also
// excludes a *preceding* hyphen: without that, "p-2em" (a hyphen-joined
// identifier, e.g. a Tailwind arbitrary-value class name) would have its
// "-" mistaken for the sign of a literal "-2em" as soon as the engine tried
// starting a match at the digit right after the hyphen. A real negative
// literal is unaffected by this, because its sign is the first character
// *of* the match — e.g. in "margin: -17px", the lookbehind is checked
// against the space before the "-", not against another hyphen — so this
// only refuses to treat a hyphen glued to a preceding identifier as a sign.
// (?!\w) on the right plays the same role for the closing boundary, and
// rejects a number/unit that is itself glued to further identifier
// characters (so "abc123px" and "x1.5rem" don't match either). A hex
// string like "#3b7d4f" is untouched by either of these: its trailing "4f"
// is never even offered to this pattern, since nothing in it forms a
// px/rem/em/s unit for a preceding number to attach to.
const NOT_BEFORE = String.raw`(?<![\w.-])`;
const NOT_AFTER = String.raw`(?!\w)`;

// Tailwind's arbitrary-value syntax forbids whitespace — a space would end
// the class name — so its arithmetic is written glued: `w-[calc(100%-16px)]`,
// `h-[calc(100vh-16px)]`. That minus is a subtraction operator, but the
// boundaries above have no way to see it as one. `100%-16px` yields the
// negative length `-16px`, because '%' passes NOT_BEFORE and the sign is
// then taken as part of the number; `100vh-16px` yields nothing at all,
// because NOT_BEFORE refuses to start a match after a hyphen. Both outcomes
// make the arithmetic-wrapper hint rule inert for the only spelling this
// syntax permits.
//
// Rather than loosen the boundaries — which would have to distinguish an
// operator from a sign by lookbehind at every call site — normalise the
// operator out of the line before lexing, the same move scanLiterals
// already makes for var() references. An operator sits between the end of a
// value (a number, with or without its unit, or '%' or ')') and the start of
// another number. A sign never does: a real negative value follows a space,
// '(', ',', ':' or '[', which is why `margin: 0 -16px` and
// `translate(-50%, -16px)` are untouched. The '{0,4}' covers the unit
// letters — px, rem, vh, dvmin — without reaching back far enough to read a
// hyphen-joined class name like `p-2em` as arithmetic, since no digit
// precedes its 'p'.
const ARITHMETIC_OPERATOR = /(?<=\d[a-z]{0,4}|[%)])[-+](?=[.\d])/g;

// Hex colours: exactly 3, 4, 6 or 8 hex digits. The previous {3,8} also
// admitted 5 and 7, which are not valid CSS hex lengths at all. The
// alternation is ordered longest-first so an 8-digit code is read as one
// 8-digit match rather than a 6-digit match plus two stray leftover
// characters.
const HEX = String.raw`#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})`;
// Not preceded by a word character, a dot, a dollar sign, or another hash:
// this is what keeps a private class field *access* like "this.#face" from
// reading as a hex literal (the disqualifying character is the '.' right
// before the '#').
const HEX_NOT_BEFORE = String.raw`(?<![\w.$#])`;
// Not followed by a word character or hyphen — kills a hash-route string
// like "#deed-section", where "-section" would otherwise look like more of
// the same token — and not followed by optional whitespace then '=', which
// kills a private-field *declaration* like "#face = 1;": that's an
// assignment target, not a colour value, and HEX_NOT_BEFORE alone can't
// catch it when the field is declared at the very start of a line (there is
// no preceding '.' to disqualify it there).
const HEX_NOT_AFTER = String.raw`(?![\w-])(?!\s*=)`;

// Lines that are pure comments never describe an actual value in the code —
// they're prose *about* one ("Use padding of 16px", "@default 300ms", "see
// #3b7d4f for reference"). Only the line's own leading punctuation is
// checked here: a '//', '/*' or '*/' prefix is unconditionally a comment.
//
// A bare '*' prefix is different: it's usually a JSDoc/block-comment body
// line, but CSS also allows a bare universal-selector rule to open with
// '*' — "* { ... }" or "*, *::before { ... }" are real, scannable CSS, not
// comments, and a reset block is one of the likeliest places in a codebase
// for an off-system value to actually be sitting. Silently skipping it
// would be a worse error than the JSDoc false positive this rule exists to
// guard against. So a '*'-prefixed line is only treated as a comment when
// what follows the '*' does NOT look like a selector running into an
// opening brace — see CSS_STAR_SELECTOR below.
//
// See the colour-function pattern further down for the larger set of known
// same-line comment/code gaps (a trailing comment after code, and the
// mirror case, a comment opener before code) that this line-level check
// does not attempt to solve.
const COMMENT_PREFIX = /^(?:\/\/|\/\*|\*\/)/;
// '*' followed only by selector-shaped characters (word characters,
// whitespace, and the punctuation CSS selectors actually use: , . : # [ ]
// ( ) > + ~ * -) and then an opening brace. Matches "* {" and
// "*, *::before {"; does not match "* @param {number} size" or
// "* @default 300ms", because '@' is not a selector character, so JSDoc
// stays classified as a comment.
const CSS_STAR_SELECTOR = /^\*[\w\s,.:#[\]()>+~*-]*\{/;

function isCommentLine(raw) {
  const trimmed = raw.trim();
  if (COMMENT_PREFIX.test(trimmed)) return true;
  if (trimmed.startsWith('*')) return !CSS_STAR_SELECTOR.test(trimmed);
  return false;
}

const PATTERNS = [
  { kind: 'color', re: new RegExp(`${HEX_NOT_BEFORE}${HEX}${HEX_NOT_AFTER}`, 'g') },
  {
    kind: 'color',
    re: /\b(?:rgba?|hsla?|oklch|oklab)\([^)]*\)/g,
    // Kept only if parseColor can actually resolve it — stricter than
    // "looks like a colour function call". An interpolated template
    // literal such as `rgba(${r}, ${g}, ${b}, ${a})`, or a nested/
    // unbalanced call such as `hsl(scale(d.value)` (the regex above only
    // matches up to the *first* closing paren, so it captures
    // "hsl(scale(d.value)" — missing its outer close), both fail to parse
    // and are correctly dropped instead of reported as a value nobody can
    // evaluate.
    //
    // Known, accepted gaps in colour/comment/unit handling — collected here
    // in one place so a reader who finds one of them sees the whole set,
    // rather than rediscovering each independently:
    //   - z-index, named alongside spacing/radius/font-size/duration in the
    //     spec's list of what the scanner reports, is deliberately not
    //     matched at all: a z-index value ("z-index: 20") is a bare
    //     unitless number, and NUMBER above always requires one of
    //     px/rem/em (the 'length' pattern) or m?s (the 'time' pattern) to
    //     follow it. Matching bare numbers would catch far more than
    //     z-index — array indices, loop bounds, flex-grow, opacity — with
    //     no way to tell which ones are actually design values.
    //   - oklab() is matched by the regex above for detection purposes,
    //     but parseColor does not implement oklab, so it is *always*
    //     filtered out by this validate and never reported. Reporting an
    //     unresolvable oklab() literal as a "finding" with no way to judge
    //     its distance from anything would itself be a kind of false
    //     claim.
    //   - rgb()/hsl() using a CSS `none` component keyword, e.g.
    //     "rgb(none 128 128)", is the same shape of gap: parseColor does
    //     not resolve `none`, so these are silently dropped too.
    //   - lab(), lch(), color() and color-mix() are not matched by this
    //     pattern at all, in any version of this scanner — the alternation
    //     above only ever covered rgb/rgba/hsl/hsla/oklch/oklab. A hex
    //     colour written *inside* a color-mix() call, e.g.
    //     "color-mix(in srgb, #3b7d4f 50%, white)", is still found and
    //     reported, because the hex pattern further up scans the whole
    //     line independently of this one.
    //   - A trailing "// ..." comment after real code on the same line
    //     ("padding: 17px; // was 16px") is not distinguished from the
    //     code before it — both "17px" and "16px" would be scanned as if
    //     they were both real values. The mirror case also exists: a
    //     comment *opener* before real code on the same line
    //     ("/** @type {string} */ const c = '#3b7d4f';") causes the whole
    //     line to be skipped as a comment by isCommentLine above, missing
    //     the real "#3b7d4f". Both are consequences of only checking a
    //     line's own leading punctuation rather than tracking where a
    //     comment actually starts and ends within a line — doing that
    //     correctly needs a real tokenizer, which this scanner
    //     deliberately does not reach for.
    validate: (value) => parseColor(value) !== null,
  },
  { kind: 'length', re: new RegExp(`${NOT_BEFORE}${NUMBER}(?:px|rem|em)${NOT_AFTER}`, 'g') },
  { kind: 'time', re: new RegExp(`${NOT_BEFORE}${NUMBER}m?s${NOT_AFTER}`, 'g') },
];

// A finding's mode follows the scale it was measured against, not the
// literal's lexical kind. One mode for every length meant a container width
// was reported as "a spacing value", and a mode broad enough to fit widths,
// radii and font sizes at once could say nothing specific about any of them.
export const GROUP_TO_ID = {
  color: 'UX-101',
  spacing: 'UX-102',
  motion: 'UX-103',
  sizing: 'UX-121',
  radius: 'UX-122',
  type: 'UX-123',
};
// A literal that was never measured belongs to no scale, so its suppression
// is filed under the mode for its kind.
const UNMEASURED_ID = { length: 'UX-102', time: 'UX-103' };
// Lengths and durations are absent on purpose: both fail closed on their
// context hint, so their groups come from HINT_GROUPS or they get none at
// all. Colours have no hint concept — a hex value is a colour wherever it
// is written.
const KIND_TO_GROUPS = { color: ['color'] };

// How many of an unusable group's own literals a suppression carries. A
// report is read, not queried: twelve rows is enough to see the shape of the
// scale a codebase is already using by hand, and `distinctLiterals` tells a
// reader the list was cut rather than letting them mistake it for the whole
// set.
const SUPPRESSION_SAMPLE = 12;

// A suppression that says "your spacing group holds two values, not a scale"
// and stops there withholds the only evidence of what a real scale would
// contain — and the scanner has just read every one of those literals. Turn
// the tally into the sample the report shows: most used first, ties broken
// by length ascending so the tail of the list still reads as a scale rather
// than an arbitrary order. A `no-context` entry has no literals map and
// passes through untouched: those lengths belong to no group, so listing
// them under a group heading would assert the membership the scanner
// deliberately refused to guess.
function summariseSuppression(entry) {
  const { literals, ...rest } = entry;
  if (!literals) return rest;
  const px = (value) => parseScalar(value)?.value ?? Number.POSITIVE_INFINITY;
  const values = [...literals.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (b.count - a.count) || (px(a.value) - px(b.value)) || a.value.localeCompare(b.value));
  return { ...rest, distinctLiterals: values.length, values: values.slice(0, SUPPRESSION_SAMPLE) };
}

// A 'length' literal's own kind never says whether it's meant to be a font
// size, a border radius, or a spacing/sizing value — those are three
// distinct token groups, and picking whichever token is merely closest in
// number (the old behaviour) lets a border-radius token "win" a match
// against a font-size literal just because the numbers happen to coincide.
// contextHint looks at a short, bounded window of text immediately before
// the literal on its line — a Tailwind arbitrary-value class prefix
// ("text-[", "rounded-[", "p-[", ...) or a CSS/JS property name
// ("font-size:", "border-radius:", "padding:", ...) — and, when it
// recognises one, names the single token group that literal actually
// belongs to. A context it does not recognise names no group at all, and
// the literal is suppressed rather than measured against every scale in
// turn — see the fail-closed branch in scanRepo. That is what keeps a
// box-shadow offset from being handed a border-radius token whose value
// happens to match.
//
// A shorthand's later values keep the property's hint: both values in
// "padding: 12px 16px" are hinted `spacing`, via SHORTHAND_VALUE below.
const CONTEXT_WINDOW = 48;
const HINT_GROUPS = { type: ['type'], radius: ['radius'], spacing: ['spacing'], sizing: ['sizing'], motion: ['motion'] };

// A prefix/property name must sit at a real word boundary — preceded by the
// start of the window or a non-identifier character — so a coincidental
// substring buried inside an unrelated longer word (e.g. "-map-" containing
// "p-") can't masquerade as a Tailwind prefix.
const HINT_BOUNDARY = String.raw`(?:^|[^A-Za-z0-9_-])`;

const escapeForRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Tailwind arbitrary-value classes always take the shape
// "<prefix>-[<value>]", immediately: the value starts right after the "[".
// An optional single extra hyphen-segment covers compound variants such as
// "rounded-tl-[10px]" or "translate-x-[10px]" without needing a separate
// entry for every corner/axis.
function bracketHintRe(prefixes) {
  const alt = prefixes.map(escapeForRegex).join('|');
  return new RegExp(`${HINT_BOUNDARY}(?:${alt})(?:-[a-z]+)?-\\[${ARITHMETIC_WRAPPER}$`, 'i');
}

// CSS/JS property names precede a value with a colon, in kebab or camel
// case ("font-size: 16px", "fontSize: 12", "padding: '17px'"), optionally
// followed by an opening quote before the value.
//
// A shorthand's later values are still that property's values: in
// "padding: 6px 16px" the 16px is a padding, not an unclassified length.
// SHORTHAND_VALUE therefore lets already-passed scalars and the handful of
// bare keywords that appear in a value list sit between the colon and the
// match. It deliberately admits nothing else — no ";", "{", "}" or "," —
// so the hint cannot leak from one declaration into the next.
const SHORTHAND_VALUE = String.raw`(?:[+-]?(?:\d+\.\d+|\.\d+|\d+)(?:px|rem|em|%)?|auto|solid|dashed|dotted|inset)\s+`;

// An operand inside an arithmetic wrapper. The unit list is the whole point
// of this rule and is deliberately short: viewport units (vh, vw, vmin,
// vmax, and their small/large/dynamic variants) are ABSENT, so an
// expression containing one cannot match. That is not an oversight to be
// tidied up later — `calc(100vh - 56px)` subtracts a header height from the
// viewport, and the 56px is a piece of layout arithmetic, not a step on the
// spacing scale. Offering it the spacing token it happens to equal is
// restyle defect 5 wearing a different hat. Because the pattern is anchored
// from the property name to the literal, an unmatchable `100vh` breaks the
// whole span and the literal falls out with no hint at all — fail-closed by
// construction, with no separate branch to get wrong.
const WRAPPER_OPERAND = String.raw`(?:[+-]?(?:\d+\.\d+|\.\d+|\d+)(?:px|rem|em|%|ch|ex)?|[-+*/,])\s*`;

// calc(), min(), max() and clamp() wrap a property's own value in
// arithmetic; the lengths inside them are still that property's lengths,
// for the same reason a shorthand's later values are. The gate stays the
// PROPERTY, not the function: `filter: blur(16px)` and
// `transform: translateY(16px)` are unhinted because filter and transform
// appear in no list below, not because blur and translateY are missing
// from this one.
const ARITHMETIC_WRAPPER = String.raw`(?:(?:calc|min|max|clamp)\(\s*(?:${WRAPPER_OPERAND})*)?`;

// A property is listed once, in kebab case, and both spellings are derived
// from it: `padding-top` also matches `paddingTop`, because stripping the
// hyphens gives `paddingtop` and these patterns are case-insensitive.
// Hand-maintaining the second spelling is what went wrong before — the type
// list carried `lineheight` and `letterspacing` but never `line-height` or
// `letter-spacing`, so stylesheets went unhinted, while the spacing list
// carried 43 kebab longhands and not one camelCase compound, so style
// objects did. Deriving both makes a half-listed property impossible.
function spellings(property) {
  const stripped = property.replace(/-/g, '');
  return stripped === property ? [property] : [property, stripped];
}

function propertyHintRe(properties) {
  const alt = properties.flatMap(spellings).map(escapeForRegex).join('|');
  return new RegExp(`${HINT_BOUNDARY}(?:${alt})\\s*:\\s*['"\`]?(?:${SHORTHAND_VALUE})*${ARITHMETIC_WRAPPER}$`, 'i');
}

const HINT_MATCHERS = [
  ['type', [
    bracketHintRe(['text', 'leading', 'tracking']),
    propertyHintRe(['font-size', 'line-height', 'letter-spacing']),
  ]],
  ['radius', [
    bracketHintRe(['rounded']),
    propertyHintRe(['border-radius']),
  ]],
  // A dimension is not a gap. Both are lengths written in the same units, so
  // one hint covered both and every width competed for the spacing scale —
  // `max-w-[1184px]`, a page container, was offered the token a 4px gutter
  // sits on. Measured across four repositories, 27% to 63% of every
  // spacing-hinted length was a width or a height, and in the thinnest case
  // the suppressed "spacing" distribution was led by 1184px and 1440px: two
  // container widths presented as the raw material for a spacing scale.
  //
  // The two lists are disjoint — no property below appears in the spacing
  // list, verified over 2,335 spacing-hinted literals — so `sizing` sitting
  // first is defensive, not load-bearing. What stays in spacing is the
  // offsets: `translate`, `top/right/bottom/left` and `inset` move a box by
  // a gap rather than giving it a dimension.
  ['sizing', [
    bracketHintRe(['w', 'h', 'size', 'min-w', 'max-w', 'min-h', 'max-h']),
    propertyHintRe([
      'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
      'inline-size', 'block-size', 'min-inline-size', 'max-inline-size',
      'min-block-size', 'max-block-size',
    ]),
  ]],
  ['spacing', [
    bracketHintRe([
      'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl',
      'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml',
      'gap', 'space',
      'top', 'left', 'right', 'bottom', 'inset', 'translate',
    ]),
    // The longhands matter as much as the shorthands: `margin-bottom` left
    // out of this list is a length with no hint, matched against every
    // group at once, and the restyle dogfood duly wrote a border-radius
    // token into a margin.
    propertyHintRe([
      'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'padding-block', 'padding-inline', 'padding-block-start', 'padding-block-end',
      'padding-inline-start', 'padding-inline-end',
      'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'margin-block', 'margin-inline', 'margin-block-start', 'margin-block-end',
      'margin-inline-start', 'margin-inline-end',
      'gap', 'row-gap', 'column-gap', 'grid-gap',
      'inset', 'inset-block', 'inset-inline',
      'inset-block-start', 'inset-block-end',
      'inset-inline-start', 'inset-inline-end',
      'top', 'right', 'bottom', 'left',
    ]),
  ]],
];

// A number followed by `s` is a duration only when something says it is.
// Unconditionally it is also an HTTP status in a test name ("404s for a
// missing thread"), a timeout in prose ("the full 3s drain window"), an
// environment value ('10s') and a decade ("the early 2060s") — across four
// real repositories most of what the time pattern matched outside stylesheets
// was one of those, and they sat in the motion distribution as if they were
// the raw material for a motion scale. Stripping comments would not have
// helped: they are strings.
//
// So a duration fails closed exactly as a length does, and three shapes vouch
// for one. A motion word before it on the same declaration — a transition or
// animation property in any spelling, a duration/delay utility, a variable
// named for its duration. An easing or fill keyword right after it, which is
// what a shorthand entry in a quoted string looks like ('left 0.3s ease').
// Or the line is nothing but a property and the duration, which is how a
// multi-line transition list continues ("  transform 0.1s,").
const MOTION_WORD = /transition|animation|animate|duration|delay|motion/i;
const EASING_AFTER = /^\s*(?:cubic-bezier\(|steps\(|(?:ease(?:-in-out|-in|-out)?|linear|step-start|step-end|infinite|forwards|backwards|alternate)(?![\w-]))/i;
const LIST_ENTRY_BEFORE = /^\s*[a-z-]+\s+$/i;
const LIST_ENTRY_AFTER = /^\s*[,;]?\s*$/;

function motionHint(line, matchIndex, matchLength) {
  const before = line.slice(Math.max(0, matchIndex - CONTEXT_WINDOW), matchIndex);
  // The declaration the literal sits in: nothing past the last `;`, `{` or
  // `}`, so a transition earlier on the line cannot vouch for a later value.
  const declaration = before.slice(Math.max(before.lastIndexOf(';'), before.lastIndexOf('{'), before.lastIndexOf('}')) + 1);
  const after = line.slice(matchIndex + matchLength);
  if (MOTION_WORD.test(declaration)) return 'motion';
  if (EASING_AFTER.test(after)) return 'motion';
  if (LIST_ENTRY_BEFORE.test(line.slice(0, matchIndex)) && LIST_ENTRY_AFTER.test(after)) return 'motion';
  return null;
}

function contextHint(line, matchIndex) {
  const window = line.slice(Math.max(0, matchIndex - CONTEXT_WINDOW), matchIndex);
  for (const [hint, patterns] of HINT_MATCHERS) {
    if (patterns.some((re) => re.test(window))) return hint;
  }
  return null;
}

// Shared by findLiterals (the public API, whose returned shape stays
// exactly {line, value, kind} — unchanged, so every existing caller and
// test keeps working) and scanRepo (which additionally needs each length
// literal's context hint to narrow which token group it's matched against).
function scanLiterals(text) {
  const out = [];
  text.split('\n').forEach((raw, index) => {
    if (raw.includes('ux-engine-ignore')) return;
    if (isCommentLine(raw)) return;
    // A line that only references tokens is on-system by construction.
    // Blank the reference rather than delete it: every column reported
    // below is an offset into the real line, and deleting text would also
    // let two unrelated fragments abut and manufacture a match.
    // One character replaced by one character, in both passes, so every
    // column reported below is still an offset into the line as written.
    // Order matters: the operator rule reads the ')' that closes a var()
    // reference as the end of a value, so it has to run while that ')' is
    // still there — `calc(var(--r)-1px)` subtracts from a token.
    const line = raw
      .replace(ARITHMETIC_OPERATOR, ' ')
      .replace(/var\(--[A-Za-z0-9_-]+\)/g, (ref) => ' '.repeat(ref.length));
    for (const { kind, re, validate } of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        if (validate && !validate(m[0])) continue;
        // A zero-valued length or duration is on-system in every design
        // system there is — "margin: 0" needs no token, in any project —
        // so it is never even reported as a finding, let alone matched
        // against the nearest token. This is handled here, at the point a
        // literal is classified, rather than inside scalarDistance's
        // existing "zero is compatible with any unit" rule: scalarDistance
        // returning 0 for a zero candidate is what let nearestToken hand
        // back whichever compatible token happened to be listed first
        // (e.g. "0px" matching "--spacing-4: 1rem"), a confident wrong
        // answer that /ux-restyle would have applied mechanically.
        if (kind === 'length' || kind === 'time') {
          const scalar = parseScalar(m[0]);
          if (scalar && scalar.value === 0) continue;
        }
        let hint = null;
        if (kind === 'length') hint = contextHint(line, m.index);
        else if (kind === 'time') hint = motionHint(line, m.index, m[0].length);
        out.push({ line: index + 1, column: m.index + 1, value: m[0], kind, hint });
      }
    }
  });
  return out.sort((a, b) => (a.line - b.line) || (a.column - b.column));
}

export function findLiteralsAt(text) {
  return scanLiterals(text).map(({ hint, ...rest }) => rest);
}

// The narrow shape, kept because it is what the scanner's own tests assert
// against and what reads clearly when position is irrelevant.
export function findLiterals(text) {
  return findLiteralsAt(text).map(({ column, ...rest }) => rest);
}

export function nearestToken(literal, tokens, thresholds) {
  let best = null;
  for (const [name, value] of Object.entries(tokens)) {
    let distance = null;
    if (literal.kind === 'color') {
      const a = parseColor(literal.value);
      const b = parseColor(value);
      if (a && b) distance = deltaE(a, b);
      if (distance !== null && distance > thresholds.color) distance = null;
    } else {
      distance = scalarDistance(parseScalar(literal.value), parseScalar(value));
      if (distance !== null && distance > thresholds.scalar) distance = null;
    }
    if (distance !== null && (best === null || distance < best.distance)) best = { token: name, distance };
  }
  return best;
}

// A plain `file.startsWith(scope)` would let "src/components" also match
// "src/components-legacy/...". Require the match to land on a path-segment
// boundary: either the file equals the scope exactly, or the scope is
// followed by a '/'.
function inScope(file, scope) {
  if (!scope) return true;
  const normalized = scope.replace(/\/+$/, '');
  return file === normalized || file.startsWith(`${normalized}/`);
}

// Spacing tokens that no name rule claimed — filed by their length value
// alone. Every other token in the group was put there because its name says
// spacing; these are the ones nothing vouched for, and so the only ones that
// might be dimensions under another name.
const UNCLAIMED_SAMPLE = 8;
function unclaimedLengthTokens(tokens) {
  return Object.keys(tokens?.spacing ?? {})
    .filter((name) => nameKind(name) === null)
    .sort()
    .slice(0, UNCLAIMED_SAMPLE);
}

export function scanRepo(root, profile, { path = null, thresholds = DEFAULT_THRESHOLDS } = {}) {
  const findings = [];
  const skipped = [];
  const suppressed = new Map();
  const excluded = new Set(profile.styling.tokenSource ?? []);

  for (const file of walkFiles(root, SCAN_EXTENSIONS)) {
    if (excluded.has(file)) continue;
    if (!inScope(file, path)) continue;

    let text;
    try {
      text = readFileSync(join(root, file), 'utf8');
    } catch (error) {
      skipped.push({ file, reason: error.code ?? 'read-error' });
      continue;
    }

    // The spec's promise — "a parse failure never fails the run" — has to
    // hold against the *next* parser bug, not just the oklch arity crash
    // this was written to fix, so the whole per-file literal scan (finding
    // literals and matching each against the token set) is guarded, not
    // just the one call site that happened to throw today. A file that
    // fails partway through contributes no findings at all rather than a
    // half-scanned mix, matching how a read failure above is handled.
    // The error's identity is recorded in the reason field (e.g.
    // "parse-error:TypeError") so a future defect is distinguishable from a
    // genuinely unparseable file; the "parse-error" prefix is kept so any
    // consumer matching on it still works.
    const startLength = findings.length;
    try {
      for (const literal of scanLiterals(text)) {
        // A length or duration whose context we could not identify gets no
        // group at all. The old `|| KIND_TO_GROUPS[literal.kind]` matched a
        // length against every length scale at once, so a box-shadow offset
        // of 10px was offered a 10px border-radius token: an exact numeric
        // match and a meaningless one. Colours have no hint concept and one
        // group, so they keep taking the map.
        const groups = KIND_TO_GROUPS[literal.kind] ?? HINT_GROUPS[literal.hint] ?? null;

        if (groups === null) {
          const id = UNMEASURED_ID[literal.kind];
          const tally = suppressed.get(`${id}|no-context`);
          if (tally) tally.count += 1;
          else suppressed.set(`${id}|no-context`, { id, reason: 'no-context', kind: literal.kind, count: 1 });
          continue;
        }
        const candidates = {};
        for (const group of groups) Object.assign(candidates, profile.tokens[group] ?? {});
        // A mode whose advice is "snap to the nearest step" has nothing to
        // offer when the candidate set is not a scale. Suppress the finding
        // and say so once, with a count, rather than emit hundreds of rows
        // measured against a scale that is not there.
        if (!isUsableScale(candidates)) {
          const id = GROUP_TO_ID[groups[0]];
          let tally = suppressed.get(`${id}|${groups.join('|')}`);
          if (tally) tally.count += 1;
          else {
            tally = {
              id,
              reason: 'unusable-scale',
              groups: [...groups],
              distinctValues: new Set(Object.values(candidates)).size,
              count: 1,
              // Keyed by the literal exactly as written. `16px` and `1rem`
              // are the same length and stay separate rows on purpose: a
              // repository writing both is saying something about itself,
              // and normalising them into one row would hide it behind a
              // number that looks tidier than the code is.
              literals: new Map(),
            };
            // An empty sizing group is the one a repository most often has
            // tokens for under names the classifier does not read as
            // dimensions — `--wrap-max`, `--shell` — and those land in
            // spacing on their value alone. Without naming them the
            // suppression says "no sizing scale" to a codebase that has one,
            // and nothing tells the reader where it went.
            if (groups[0] === 'sizing') {
              const unclaimed = unclaimedLengthTokens(profile.tokens);
              if (unclaimed.length) tally.unclaimedTokens = unclaimed;
            }
            suppressed.set(`${id}|${groups.join('|')}`, tally);
          }
          tally.literals.set(literal.value, (tally.literals.get(literal.value) ?? 0) + 1);
          continue;
        }
        const hit = nearestToken(literal, candidates, thresholds);
        findings.push({
          id: GROUP_TO_ID[groups[0]],
          file,
          line: literal.line,
          column: literal.column,
          value: literal.value,
          kind: literal.kind,
          // Which scale this literal was actually measured against. It was
          // computed just above to pick the candidate tokens and then
          // thrown away, so every consumer downstream — the report row, the
          // mode a reader looks up — had to assume spacing and was wrong
          // for 403 of the 403 length findings four real repositories
          // produced. Joined rather than indexed: every group list is one
          // element today, and a hint that ever maps to two should read as
          // "spacing+sizing", not silently lose one.
          group: groups.join('+'),
          nearestToken: hit?.token ?? null,
          distance: hit?.distance ?? null,
        });
      }
    } catch (error) {
      findings.length = startLength;
      const errorType = error?.constructor?.name ?? 'Error';
      skipped.push({ file, reason: `parse-error:${errorType}` });
    }
  }
  return { findings, skipped, suppressed: [...suppressed.values()].map(summariseSuppression) };
}
