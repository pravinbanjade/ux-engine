import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CATEGORIES = [
  'information-architecture', 'interaction', 'visual-hierarchy', 'state-coverage',
  'forms', 'data-display', 'accessibility', 'system-consistency',
];
export const SEVERITIES = ['high', 'medium', 'low'];
export const DETECTIONS = ['model', 'scanner', 'hybrid'];

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
  if (!Array.isArray(data.appliesTo) || data.appliesTo.length === 0) errors.push(`${filename}: appliesTo must be a non-empty list`);

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
