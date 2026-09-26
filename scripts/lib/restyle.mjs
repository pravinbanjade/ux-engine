import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseColor, deltaE } from './color.mjs';
import { DEFAULT_THRESHOLDS } from './scanner.mjs';

// A utility class's arbitrary value — bg-[#3b7d4f], p-[17px] — is the one
// context that looks substitutable and is not: turning it into a utility
// name needs a token-to-utility-family mapping no profile records, and
// inferring the family from the token's name is guesswork.
const ARBITRARY_OPEN = /-\[$/;

// Walking left from the literal, a property name followed by a colon, with
// no other declaration punctuation in between. True for a stylesheet rule,
// for the same text inside a template literal, and for a JS style object's
// quoted value — the three places `var()` is legal. A named call argument
// (`f(x: '17px')`) also matches; that is rare enough in JS to accept, and
// the preview gate is where it would be caught.
const DECLARATION_BEFORE = /(?:^|[{;,(])\s*['"`]?[-A-Za-z][-A-Za-z0-9]*['"`]?\s*:\s*[^:;{}]*$/;

// The property a declaration-shaped prefix names, as written.
const PROPERTY_BEFORE = /(?:^|[{;,(])\s*['"`]?([-A-Za-z][-A-Za-z0-9]*)['"`]?\s*:\s*[^:;{}]*$/;

// Lengths and durations reach a plan only through the scanner's property
// hint table, so their key is already a CSS property. A colour has no hint:
// the scanner reports a hex value wherever it is written, and a JS constants
// object — `PRIMARY: '#1890ff'`, handed to a chart library or a canvas —
// is declaration-shaped too. `var()` in a string a canvas paints resolves to
// nothing. So a colour is substituted only under a property that takes one.
// Listed in kebab case; the camelCase spelling of a style object is matched
// by comparing with the hyphens stripped, as the scanner does.
const COLOR_PROPERTIES = new Set([
  'color', 'background', 'background-color', 'background-image',
  'border', 'border-color', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-block', 'border-inline', 'border-block-color', 'border-inline-color',
  'border-block-start-color', 'border-block-end-color', 'border-inline-start-color', 'border-inline-end-color',
  'outline', 'outline-color', 'box-shadow', 'text-shadow', 'text-decoration', 'text-decoration-color',
  'text-emphasis-color', 'caret-color', 'accent-color', 'column-rule', 'column-rule-color',
  'fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'scrollbar-color',
  '-webkit-text-fill-color', '-webkit-text-stroke-color', '-webkit-tap-highlight-color',
].map((p) => p.replace(/-/g, '')));

// `console.log('%c…', 'color: #ff4d4f')` styles the devtools console, which
// never loads the app's stylesheet.
const CONSOLE_CALL = /\bconsole\.[a-z]+\s*\(/i;

export function substitutionFor({ lineText, column, value, token, kind }) {
  const before = lineText.slice(0, column - 1);
  const after = lineText.slice(column - 1 + value.length);

  if (after.startsWith(']') && ARBITRARY_OPEN.test(before)) {
    return { manual: true, reason: 'arbitrary-utility-value' };
  }
  if (!DECLARATION_BEFORE.test(before) || CONSOLE_CALL.test(before)) {
    return { manual: true, reason: 'unsupported-context' };
  }
  if (kind === 'color') {
    const property = PROPERTY_BEFORE.exec(before)?.[1] ?? '';
    if (!COLOR_PROPERTIES.has(property.replace(/-/g, '').toLowerCase())) {
      return { manual: true, reason: 'unsupported-context' };
    }
  }
  return { text: `var(${token})` };
}

// The nearest directory at or above `file` holding a package.json, relative
// to the repo root: '' for the root itself, or when no package.json exists
// at all, which makes a single-package repo one package throughout.
function packageOf(file, root, memo) {
  let dir = dirname(file);
  const seen = [];
  for (;;) {
    if (memo.has(dir)) {
      const found = memo.get(dir);
      for (const d of seen) memo.set(d, found);
      return found;
    }
    seen.push(dir);
    if (dir === '.' || dir === '' || existsSync(join(root, dir, 'package.json'))) {
      const found = dir === '.' ? '' : dir;
      for (const d of seen) memo.set(d, found);
      return found;
    }
    dir = dirname(dir);
  }
}

// The scanner hands every colour the token nearest in colour, and nearness
// is all it knows: `#ffffff` under `background-color` went to
// `--status-empty-bg` because that was the only parseable white in the set,
// and a restyle would have written a status token into a page background.
// Two things a token's name says, that its value cannot:
//
// - what it is for: a `-fg`/`-foreground`/`text-` token paints text, a
//   `-bg`/`surface`/`card` token fills a box, a `border`/`ring`/`input`
//   token draws an edge. The last role word wins, so `--card-foreground`
//   is text on a card.
// - whether it carries meaning: a `status`, `success` or `error` token says
//   something about the state of what it colours, and reusing it because
//   the number fits says that thing where it is not true.
//
// So the choice is made among every token close enough, not just the
// nearest: tokens whose role contradicts the property's are out, state
// tokens are never applied mechanically, a token whose role matches beats
// one with no role, and distance breaks ties. When only a contradicting or
// state token is close, the finding goes to a human with it as the
// suggestion — the number may be right and the meaning may still be wrong.
const ROLE_SEGMENTS = [
  ['fg', /^(?:fg|foreground|text|ink)$/],
  ['bg', /^(?:bg|background|surface|card|popover|paper\d*|canvas|backdrop)$/],
  ['border', /^(?:border|outline|ring|divider|separator|stroke|input)$/],
];
const STATE_SEGMENT = /^(?:status|success|danger|error|warning|warn|info|destructive|critical|positive|negative)$/;

// A system token's name is a role, a variant and perhaps a hue or a step:
// `--text-muted`, `--color-primary-300`, `--navy-dark`. A segment outside that
// vocabulary names the component or the domain the token was made for —
// `--chip-academic-accent`, `--calendar-cell-holiday-bg`, `--loyalty-border`
// — and reusing one elsewhere because the colour fits ties an unrelated
// element to that component's next redesign. A short first segment is a
// namespace (`--y-indigo-soft`), not a component. The list is deliberately
// closed: an unfamiliar word costs a suggestion instead of an edit, which is
// the cheap direction to be wrong in.
const GENERIC_SEGMENT = new RegExp(`^(?:${[
  'color', 'colour', 'app', 'page', 'body', 'ui', 'sys', 'global', 'theme',
  'primary', 'secondary', 'tertiary', 'accent', 'muted', 'subtle', 'faint', 'strong', 'soft',
  'light', 'lighter', 'lightest', 'dark', 'darker', 'darkest', 'deep', 'bright', 'pale',
  'hover', 'active', 'focus', 'pressed', 'disabled', 'inverse', 'inverted', 'default', 'base',
  'brand', 'neutral', 'emphasis', 'contrast', 'alt', 'main', 'on', 'weak', 'mid', 'medium',
  'low', 'high', 'raised', 'sunken', 'elevated', 'overlay', 'sm', 'md', 'lg', 'xl',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue',
  'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'slate', 'gray', 'grey', 'zinc',
  'stone', 'navy', 'white', 'black', 'graphite', 'steel', 'silver', 'gold', 'cream', 'sand',
  'olive', 'maroon', 'coral', 'mint',
].join('|')}|\\d+)$`);

export function isScopedToken(name) {
  return segments(name).some((segment, i) => {
    if (i === 0 && segment.length <= 2) return false;
    if (STATE_SEGMENT.test(segment) || GENERIC_SEGMENT.test(segment)) return false;
    return !ROLE_SEGMENTS.some(([, re]) => re.test(segment));
  });
}

const PROPERTY_ROLE = new Map([
  ...['color', 'caret-color', 'text-decoration-color', 'text-emphasis-color', '-webkit-text-fill-color', '-webkit-text-stroke-color']
    .map((p) => [p, 'fg']),
  ...['background', 'background-color', 'background-image'].map((p) => [p, 'bg']),
].map(([p, role]) => [p.replace(/-/g, ''), role]));

function propertyRole(property) {
  const key = property.replace(/-/g, '').toLowerCase();
  if (PROPERTY_ROLE.has(key)) return PROPERTY_ROLE.get(key);
  if (/^(?:border|outline|columnrule)/.test(key)) return 'border';
  return null;
}

function segments(name) {
  return name.replace(/^--/, '').toLowerCase().split(/[-_]/);
}

export function tokenRole(name) {
  let role = null;
  for (const segment of segments(name)) {
    for (const [r, re] of ROLE_SEGMENTS) if (re.test(segment)) role = r;
  }
  return role;
}

export function isStateToken(name) {
  return segments(name).some((segment) => STATE_SEGMENT.test(segment));
}

// Close enough to report is not close enough to write. The scanner's
// threshold decides which token a finding names, and at 0.10 it pairs `#fff`
// with an orange tint and a slate grey with a dark teal: fair suggestions,
// visible changes. A mechanical substitution promises the page looks the
// same afterwards, so it is held to about the smallest difference a person
// can see in this colour space; anything further is a design decision and
// goes to a human with the suggestion.
export const EXACT_COLOR = 0.02;

export function chooseColourToken({ value, property, tokens, themed = [], threshold = DEFAULT_THRESHOLDS.color }) {
  const themedSet = new Set(themed);
  const literal = parseColor(value);
  if (!literal) return { manual: true, reason: 'no-token', token: null };
  const close = [];
  for (const [name, tokenValue] of Object.entries(tokens)) {
    const parsed = parseColor(tokenValue);
    if (!parsed) continue;
    const distance = deltaE(literal, parsed);
    if (distance <= threshold) {
      close.push({
        name, distance, role: tokenRole(name), state: isStateToken(name),
        scoped: isScopedToken(name), themed: themedSet.has(name),
      });
    }
  }
  if (!close.length) return { manual: true, reason: 'no-token', token: null };
  close.sort((a, b) => (a.distance - b.distance) || a.name.localeCompare(b.name));

  const wanted = propertyRole(property);
  const contradicts = (t) => Boolean(wanted && t.role && t.role !== wanted);
  const eligible = close.filter((t) => !t.state && !t.scoped && !t.themed && !contradicts(t));
  if (!eligible.length) {
    const t = close[0];
    let reason = 'role-mismatch';
    if (t.state) reason = 'semantic-token';
    else if (t.scoped) reason = 'scoped-token';
    else if (t.themed) reason = 'theme-varying';
    return { manual: true, reason, token: t.name };
  }
  const best = (wanted && eligible.find((t) => t.role === wanted)) || eligible[0];
  if (best.distance > EXACT_COLOR) return { manual: true, reason: 'approximate', token: best.name };
  return { token: best.name };
}

// A file that renders somewhere other than the DOM takes style objects that
// look exactly like CSS and never see a stylesheet: a PDF document, a native
// view, a terminal, a WebGL scene. `color: '#0F172A'` in a PDF renderer's
// StyleSheet is a real colour property and `var()` there prints nothing.
// Found by the restyle pass on a repository whose risk report was a PDF
// component, whose every heading would have lost its colour. Judged per
// file, from its imports, because that is where the renderer is named.
const NON_DOM_RENDERER = /(?:\bfrom\s*|\brequire\(\s*|\bimport\s*\(?\s*)['"](?:@react-pdf\/renderer|react-native(?:-[\w-]+)?|@react-three\/[\w-]+|ink|pdfkit|jspdf|@shopify\/react-native-skia|expo(?:-[\w-]+)?)(?:\/[^'"]*)?['"]/;

export function planSubstitutions(envelope, { root, tokenSource = [], colorTokens = null, themedTokens = [] }) {
  const edits = [];
  const manual = [];
  const judgment = [];
  // One read per file, however many findings it carries.
  const cache = new Map();
  const nonDom = new Map();

  // `var(--token)` resolves only where the stylesheet declaring the token is
  // loaded, and in a monorepo that is the package the token source lives in.
  // A literal in another package — a server's HTML email template, a CLI's
  // terminal colours — reads like CSS and is not styled by these tokens:
  // substituting there writes a reference that resolves to nothing, and an
  // email's background silently disappears. Found by the restyle pass on a
  // repository whose API seeded email templates with the same greys the
  // frontend had tokens for. A profile with no token source has nothing to
  // compare against, and keeps the old behaviour.
  const packages = new Map();
  const tokenPackages = new Set(tokenSource.map((f) => packageOf(f, root, packages)));

  for (const finding of envelope.findings) {
    if (finding.source !== 'scanner') {
      judgment.push(finding);
      continue;
    }
    if (!finding.nearestToken) {
      manual.push({ ...finding, reason: 'no-token' });
      continue;
    }
    if (!Number.isInteger(finding.column)) {
      manual.push({ ...finding, reason: 'no-column' });
      continue;
    }
    if (tokenPackages.size && !tokenPackages.has(packageOf(finding.file, root, packages))) {
      manual.push({ ...finding, reason: 'outside-token-package' });
      continue;
    }

    if (!cache.has(finding.file)) {
      try {
        cache.set(finding.file, readFileSync(join(root, finding.file), 'utf8').split('\n'));
      } catch {
        cache.set(finding.file, null);
      }
    }
    const lines = cache.get(finding.file);
    if (lines === null) {
      manual.push({ ...finding, reason: 'unreadable' });
      continue;
    }
    if (!nonDom.has(finding.file)) nonDom.set(finding.file, NON_DOM_RENDERER.test(lines.join('\n')));
    if (nonDom.get(finding.file)) {
      manual.push({ ...finding, reason: 'non-dom-renderer' });
      continue;
    }

    // A findings file is only true of the tree it was generated against.
    // Confirm the literal is still exactly here before planning a splice.
    const lineText = lines[finding.line - 1];
    const at = finding.column - 1;
    if (lineText === undefined || lineText.slice(at, at + finding.value.length) !== finding.value) {
      manual.push({ ...finding, reason: 'moved' });
      continue;
    }

    const result = substitutionFor({
      lineText, column: finding.column, value: finding.value, token: finding.nearestToken, kind: finding.kind,
    });
    if (result.manual) {
      manual.push({ ...finding, reason: result.reason });
      continue;
    }

    let token = finding.nearestToken;
    if (finding.kind === 'color' && colorTokens) {
      const property = PROPERTY_BEFORE.exec(lineText.slice(0, finding.column - 1))?.[1] ?? '';
      const choice = chooseColourToken({ value: finding.value, property, tokens: colorTokens, themed: themedTokens });
      if (choice.manual) {
        manual.push({ ...finding, nearestToken: choice.token ?? finding.nearestToken, reason: choice.reason });
        continue;
      }
      token = choice.token;
    }

    edits.push({
      id: finding.id,
      file: finding.file,
      line: finding.line,
      column: finding.column,
      value: finding.value,
      token,
      replacement: `var(${token})`,
    });
  }

  return { edits, manual, judgment };
}

export function applyEdits(edits, { root, dryRun = false }) {
  const byFile = new Map();
  for (const edit of edits) {
    if (!byFile.has(edit.file)) byFile.set(edit.file, []);
    byFile.get(edit.file).push(edit);
  }

  const files = [];
  const failed = [];

  for (const [file, list] of byFile) {
    let lines;
    try {
      // split('\n') then join('\n') is lossless, so a file without a
      // trailing newline does not silently acquire one.
      lines = readFileSync(join(root, file), 'utf8').split('\n');
    } catch (error) {
      failed.push({ file, reason: error.code ?? 'read-error' });
      continue;
    }

    // Rightmost first: every column is an offset into the line as it is
    // now, and a replacement is longer than the literal it replaces.
    const ordered = [...list].sort((a, b) => (b.line - a.line) || (b.column - a.column));
    for (const edit of ordered) {
      const i = edit.line - 1;
      const at = edit.column - 1;
      lines[i] = lines[i].slice(0, at) + edit.replacement + lines[i].slice(at + edit.value.length);
    }

    if (!dryRun) {
      try {
        writeFileSync(join(root, file), lines.join('\n'));
      } catch (error) {
        failed.push({ file, reason: error.code ?? 'write-error' });
        continue;
      }
    }
    files.push({ file, edits: list.length });
  }

  return { files, failed, applied: files.reduce((n, f) => n + f.edits, 0) };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const cite = (row) => (row.line === null || row.line === undefined
  ? `\`${row.file}\``
  : `\`${row.file}:${row.line}\``);

export function renderPlan({ edits, manual, judgment }) {
  const fileCount = new Set(edits.map((e) => e.file)).size;

  const summary = [
    `${plural(edits.length, 'substitution', 'substitutions')} in ${plural(fileCount, 'file', 'files')}`,
  ];
  if (manual.length) summary.push(`${manual.length} ${manual.length === 1 ? 'needs' : 'need'} a human`);
  if (judgment.length) summary.push(`${judgment.length} ${judgment.length === 1 ? 'needs' : 'need'} judgment`);

  const out = ['# UX restyle plan', ''];
  if (!edits.length && !manual.length && !judgment.length) {
    out.push('Nothing to restyle.', '');
    return out.join('\n');
  }
  out.push(summary.join(' · '), '');

  if (edits.length) {
    out.push('## Substitutions', '');
    const byFile = new Map();
    for (const edit of edits) {
      if (!byFile.has(edit.file)) byFile.set(edit.file, []);
      byFile.get(edit.file).push(edit);
    }
    for (const [file, list] of byFile) {
      out.push(`### \`${file}\``, '');
      for (const edit of list) {
        out.push(`- L${edit.line}:${edit.column} \`${edit.value}\` → \`${edit.replacement}\` (${edit.id})`);
      }
      out.push('');
    }
  }

  // Manual rows still carry the answer — the token to use — so this list is
  // a work queue, not a shrug.
  if (manual.length) {
    out.push('## Needs a human', '');
    for (const row of manual) {
      const target = row.nearestToken ? ` → \`${row.nearestToken}\`` : '';
      out.push(`- ${cite(row)} — \`${row.value}\`${target}: ${row.reason}`);
    }
    out.push('');
  }

  if (judgment.length) {
    out.push('## Needs judgment', '');
    for (const row of judgment) {
      out.push(`- **${row.id}** · ${cite(row)} — ${row.message}`);
    }
    out.push('');
  }

  return out.join('\n');
}
