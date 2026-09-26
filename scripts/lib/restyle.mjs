import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

// A file that renders somewhere other than the DOM takes style objects that
// look exactly like CSS and never see a stylesheet: a PDF document, a native
// view, a terminal, a WebGL scene. `color: '#0F172A'` in a PDF renderer's
// StyleSheet is a real colour property and `var()` there prints nothing.
// Found by the restyle pass on a repository whose risk report was a PDF
// component, whose every heading would have lost its colour. Judged per
// file, from its imports, because that is where the renderer is named.
const NON_DOM_RENDERER = /(?:\bfrom\s*|\brequire\(\s*|\bimport\s*\(?\s*)['"](?:@react-pdf\/renderer|react-native(?:-[\w-]+)?|@react-three\/[\w-]+|ink|pdfkit|jspdf|@shopify\/react-native-skia|expo(?:-[\w-]+)?)(?:\/[^'"]*)?['"]/;

export function planSubstitutions(envelope, { root, tokenSource = [] }) {
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

    edits.push({
      id: finding.id,
      file: finding.file,
      line: finding.line,
      column: finding.column,
      value: finding.value,
      token: finding.nearestToken,
      replacement: result.text,
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
