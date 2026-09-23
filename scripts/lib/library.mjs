import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CATEGORIES = [
  'information-architecture', 'interaction', 'visual-hierarchy', 'state-coverage',
  'forms', 'data-display', 'accessibility', 'system-consistency', 'conformance',
];
export const SEVERITIES = ['high', 'medium', 'low'];
// `conformance` findings need an approved wireframe to compare against, which
// only /ux-design has. /ux-audit skips them for the same reason it skips
// `scanner` modes: something else is already answering that question.
export const DETECTIONS = ['model', 'scanner', 'hybrid', 'conformance'];

// The ID is not a serial number: its range declares the category. Promoting
// the convention to a checked rule means a mode's number and its category can
// never drift apart, and makes "the catalog is complete" a real assertion
// rather than a count that happens to match.
export const CATEGORY_RANGES = {
  'information-architecture': [1, 13],
  'interaction': [14, 30],
  'visual-hierarchy': [31, 45],
  'state-coverage': [46, 60],
  'forms': [61, 75],
  'data-display': [76, 90],
  'accessibility': [91, 100],
  'system-consistency': [101, 110],
  'conformance': [111, 120],
};

// Closed, because select-modes.mjs filters on these values. A freeform
// vocabulary makes the selector guessable-at rather than callable: a caller
// who types `tables` instead of `table` would get an empty result and
// conclude no mode applies. Exit 2 on an unknown kind is only possible
// because this list is finite.
export const APPLIES_TO = [
  'any',
  'page', 'page-header', 'breadcrumb', 'navbar', 'nav-item', 'sidebar', 'toolbar', 'menu', 'tabs',
  'list', 'table', 'table-row-actions', 'pagination',
  'card', 'grid', 'detail-view', 'dashboard', 'stat-tile', 'chart', 'search-results',
  'form', 'field', 'form-footer', 'form-submit', 'stepper', 'select',
  'button', 'button-group', 'icon-button', 'link',
  'modal', 'toast', 'tooltip', 'badge', 'status-indicator', 'avatar',
  'empty-state', 'settings', 'generated-ui',
];

const SECTION_MINIMUMS = {
  '## Signal': 120,
  '## Why it fails': 120,
  '## Fix': 100,
  '## Counter-example — when this is fine': 80,
};

// A Fix that says "add appropriate error handling" has told the reader
// nothing they did not already know. These phrases are how a mode file looks
// when its author had no specific remedy in mind.
const GENERIC_FIX_PHRASES = [
  'add appropriate', 'consider using', 'make sure to',
  'as needed', 'where necessary', 'as appropriate',
];

// Section bodies, keyed by heading. No /m flag on the body slice: headings are
// matched line-anchored, then each body runs to the next heading.
export function sectionBodies(body) {
  const out = {};
  const headings = [...body.matchAll(/^## (.*)$/gm)];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index + headings[i][0].length;
    const end = i + 1 < headings.length ? headings[i + 1].index : body.length;
    out[`## ${headings[i][1]}`] = body.slice(start, end).trim();
  }
  return out;
}

const STOP_WORDS = new Set(
  ('a an the and or of to in on is are it its that this with for as not no by at from be been has '
  + 'have which when where what who use used using there their they them').split(' '),
);

function contentWords(text) {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

// Jaccard over content words. Two modes that describe the same code shape in
// the same category are one mode with two numbers, and at 120 entries that is
// the failure this catalog is most likely to grow.
export function signalSimilarity(a, b) {
  const x = contentWords(a);
  const y = contentWords(b);
  if (x.size === 0 && y.size === 0) return 1;
  const union = new Set([...x, ...y]);
  if (union.size === 0) return 1;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / union.size;
}

// Fixed, not a dial. A new mode that trips this against an existing one is
// saying something the catalog already says; the answer is to rewrite or cut
// the mode, never to lower the number.
export const SIGNAL_SIMILARITY_LIMIT = 0.7;

export function checkCrossFile(modes) {
  const errors = [];

  const byId = new Map();
  for (const m of modes) {
    if (byId.has(m.data.id)) errors.push(`${m.filename}: duplicate id ${m.data.id} (also ${byId.get(m.data.id)})`);
    else byId.set(m.data.id, m.filename);
  }

  const byTitle = new Map();
  for (const m of modes) {
    const key = String(m.data.title ?? '').trim().toLowerCase();
    if (!key) continue;
    if (byTitle.has(key)) errors.push(`${m.filename}: title duplicates ${byTitle.get(key)}`);
    else byTitle.set(key, m.filename);
  }

  const signals = modes.map((m) => ({
    filename: m.filename,
    category: m.data.category,
    signal: sectionBodies(m.body)['## Signal'] ?? '',
  }));
  for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      if (signals[i].category !== signals[j].category) continue;
      const score = signalSimilarity(signals[i].signal, signals[j].signal);
      if (score >= SIGNAL_SIMILARITY_LIMIT) {
        errors.push(
          `${signals[i].filename}: Signal is ${score.toFixed(2)} similar to ${signals[j].filename} `
          + `(limit ${SIGNAL_SIMILARITY_LIMIT}) — rewrite or cut one, do not lower the limit`,
        );
      }
    }
  }

  return errors;
}

const REQUIRED_SECTIONS = [
  '## Signal',
  '## Why it fails',
  '## Fix',
  '## Counter-example — when this is fine',
];

// Deliberately a tiny YAML subset: scalars and inline [a, b] lists. Enough for
// this frontmatter, and keeps the repo dependency-free.
export function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) return { data: {}, body: text };
  const data = {};
  for (const line of match[1].split('\n')) {
    const kv = /^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, key, raw] = kv;
    const value = raw.trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      data[key] = inner === '' ? [] : inner.split(',').map((s) => s.trim());
    } else {
      data[key] = value;
    }
  }
  return { data, body: match[2] };
}

export function validateModeFile({ filename, text }) {
  const errors = [];
  const { data, body } = parseFrontmatter(text);

  if (!data.id) errors.push(`${filename}: missing id`);
  else if (!/^UX-\d{3}$/.test(data.id)) errors.push(`${filename}: id "${data.id}" must match UX-NNN`);
  else if (!filename.startsWith(`${data.id}-`)) errors.push(`${filename}: id "${data.id}" does not match the filename prefix`);

  if (!data.title) errors.push(`${filename}: missing title`);
  if (!CATEGORIES.includes(data.category)) errors.push(`${filename}: unknown category "${data.category}"`);
  if (!SEVERITIES.includes(data.severity)) errors.push(`${filename}: unknown severity "${data.severity}"`);
  if (!DETECTIONS.includes(data.detection)) errors.push(`${filename}: unknown detection "${data.detection}"`);
  if (!Array.isArray(data.appliesTo) || data.appliesTo.length === 0) {
    errors.push(`${filename}: appliesTo must be a non-empty list`);
  } else {
    for (const kind of data.appliesTo) {
      if (!APPLIES_TO.includes(kind)) errors.push(`${filename}: appliesTo value "${kind}" is not in APPLIES_TO`);
    }
  }

  // The ID range declares the category. Checked only when both are otherwise
  // valid, so a malformed ID reports one clear error instead of two.
  if (/^UX-\d{3}$/.test(data.id ?? '') && CATEGORY_RANGES[data.category]) {
    const n = Number(data.id.slice(3));
    const [lo, hi] = CATEGORY_RANGES[data.category];
    if (n < lo || n > hi) {
      errors.push(`${filename}: id ${data.id} is outside the ${data.category} range ${lo}-${hi}`);
    }
  }

  // Extract all ## headings (line-anchored)
  const headings = [];
  const headingRegex = /^## (.*)$/gm;
  let match;
  while ((match = headingRegex.exec(body)) !== null) {
    headings.push(`## ${match[1]}`);
  }

  // Check for missing, extra, or reordered sections
  const headingSet = new Set(headings);
  const requiredSet = new Set(REQUIRED_SECTIONS);

  // Check for missing sections
  for (const section of REQUIRED_SECTIONS) {
    if (!headingSet.has(section)) {
      errors.push(`${filename}: missing required section "${section}"`);
    }
  }

  // Check for extra sections
  for (const heading of headings) {
    if (!requiredSet.has(heading)) {
      errors.push(`${filename}: unexpected section "${heading}"`);
    }
  }

  // Check order (only if we have all required sections)
  if (headings.length === REQUIRED_SECTIONS.length) {
    for (let i = 0; i < headings.length; i++) {
      if (headings[i] !== REQUIRED_SECTIONS[i]) {
        errors.push(`${filename}: sections must appear in order: ${REQUIRED_SECTIONS.map(s => s.replace(/^## /, '')).join(', ')}`);
        break;
      }
    }
  }

  const sections = sectionBodies(body);
  for (const [heading, min] of Object.entries(SECTION_MINIMUMS)) {
    const text = sections[heading];
    if (text !== undefined && text.length < min) {
      errors.push(`${filename}: "${heading.replace(/^## /, '')}" is ${text.length} chars, needs at least ${min}`);
    }
  }

  const fix = (sections['## Fix'] ?? '').toLowerCase();
  for (const phrase of GENERIC_FIX_PHRASES) {
    if (fix.includes(phrase)) errors.push(`${filename}: Fix contains the non-answer "${phrase}"`);
  }

  return errors;
}

export function indexLine(data) {
  return [data.id, data.category, data.severity, data.detection, data.title].join(' | ');
}

export function checkIndex(modes, indexText) {
  const errors = [];
  const lines = indexText.split('\n').map((l) => l.trim()).filter(Boolean);
  const byId = new Map(lines.map((l) => [l.split(' | ')[0], l]));

  for (const { data } of modes) {
    const expected = indexLine(data);
    const actual = byId.get(data.id);
    if (!actual) errors.push(`INDEX.md: no line for ${data.id}`);
    else if (actual !== expected) errors.push(`INDEX.md: line for ${data.id} is stale\n  expected: ${expected}\n  actual:   ${actual}`);
    byId.delete(data.id);
  }
  for (const id of byId.keys()) errors.push(`INDEX.md: line for ${id} has no mode file`);

  const ids = lines.map((l) => l.split(' | ')[0]);
  const sorted = [...ids].sort();
  if (ids.join(',') !== sorted.join(',')) errors.push('INDEX.md: lines must be sorted by ID');

  return errors;
}

export function loadModes(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'INDEX.md')
    .sort()
    .map((filename) => {
      const text = readFileSync(join(dir, filename), 'utf8');
      const { data, body } = parseFrontmatter(text);
      return { filename, text, data, body };
    });
}

// Findings carry a mode id; reports and validation need the mode's own
// severity, category and fix line. Reading them here, once, keeps a
// finding from ever disagreeing with the mode it names.
function firstFixLine(body) {
  // No /m flag: with it, `$` means end-of-line and the lazy capture stops
  // after the heading's first line instead of running to the next section.
  const section = /(?:^|\n)## Fix\n([\s\S]*?)(?=\n## |$)/.exec(body);
  if (!section) return '';
  // The first *paragraph*, unwrapped — not the first line. Mode files hard-wrap
  // their prose, so taking one line hands a report a sentence fragment ending
  // mid-clause, which is worse than no advice at all.
  const paragraph = [];
  for (const line of section[1].split('\n')) {
    const text = line.trim();
    if (text.startsWith('#')) continue;
    if (!text) {
      if (paragraph.length) break;
      continue;
    }
    paragraph.push(text);
  }
  return paragraph.join(' ');
}

export function modeIndex(dir) {
  const index = new Map();
  for (const { data, body } of loadModes(dir)) {
    index.set(data.id, {
      id: data.id,
      title: data.title,
      category: data.category,
      severity: data.severity,
      detection: data.detection,
      fix: firstFixLine(body),
    });
  }
  return index;
}
