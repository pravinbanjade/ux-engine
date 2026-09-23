import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, validateModeFile, indexLine, checkIndex } from '../scripts/lib/library.mjs';

const VALID = `---
id: UX-014
title: Destructive action weighted equally with its safe sibling
category: interaction
severity: high
detection: model
appliesTo: [button-group, table-row-actions]
---
## Signal
A row action group renders Delete with the same button variant, size and colour weight as Edit, so the
irreversible action and the reversible one are visually interchangeable.

## Why it fails
A pointer travelling to a row of identical buttons is aimed by position, not by reading. Weighting the
destructive action equally makes a misfire a matter of a few pixels, and the result cannot be undone.

## Fix
Render Delete as a text or ghost button and keep the solid variant for Edit, so the destructive option
costs one extra beat of attention to reach.

## Counter-example — when this is fine
A screen whose only purpose is deletion, where every action present is destructive and there is no safer
sibling to confuse it with.
`;

test('parseFrontmatter splits data from body', () => {
  const { data, body } = parseFrontmatter(VALID);
  assert.equal(data.id, 'UX-014');
  assert.equal(data.severity, 'high');
  assert.deepEqual(data.appliesTo, ['button-group', 'table-row-actions']);
  assert.match(body, /^## Signal/);
});

test('a well-formed mode file produces no errors', () => {
  assert.deepEqual(validateModeFile({ filename: 'UX-014-equal-weight-destructive.md', text: VALID }), []);
});

test('id must match the filename prefix', () => {
  const errors = validateModeFile({ filename: 'UX-015-equal-weight-destructive.md', text: VALID });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /filename/);
});

test('a missing counter-example is an error', () => {
  const text = VALID.replace(/## Counter-example[\s\S]*$/, '');
  const errors = validateModeFile({ filename: 'UX-014-equal-weight-destructive.md', text });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Counter-example/);
});

test('an unknown category is an error', () => {
  const text = VALID.replace('category: interaction', 'category: vibes');
  const errors = validateModeFile({ filename: 'UX-014-equal-weight-destructive.md', text });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /category/);
});

test('a missing title is an error', () => {
  const text = VALID.replace('title: Destructive action weighted equally with its safe sibling', 'title:');
  const errors = validateModeFile({ filename: 'UX-014-equal-weight-destructive.md', text });
  assert.ok(errors.some((e) => /missing title/.test(e)));
});

test('an invalid severity is an error', () => {
  const text = VALID.replace('severity: high', 'severity: critical');
  const errors = validateModeFile({ filename: 'UX-014-equal-weight-destructive.md', text });
  assert.ok(errors.some((e) => /severity/.test(e)));
});

test('an invalid detection mode is an error', () => {
  const text = VALID.replace('detection: model', 'detection: static');
  const errors = validateModeFile({ filename: 'UX-014-equal-weight-destructive.md', text });
  assert.ok(errors.some((e) => /detection/.test(e)));
});

test('an empty appliesTo list is an error', () => {
  const text = VALID.replace('appliesTo: [button-group, table-row-actions]', 'appliesTo: []');
  const errors = validateModeFile({ filename: 'UX-014-equal-weight-destructive.md', text });
  assert.ok(errors.some((e) => /appliesTo/.test(e)));
});

test('a missing appliesTo is an error', () => {
  const text = VALID.replace(/appliesTo: \[button-group, table-row-actions\]\n/, '');
  const errors = validateModeFile({ filename: 'UX-014-equal-weight-destructive.md', text });
  assert.ok(errors.some((e) => /appliesTo/.test(e)));
});

test('a section at wrong heading level (### instead of ##) is rejected', () => {
  const text = VALID.replace('## Signal', '### Signal');
  const errors = validateModeFile({ filename: 'UX-014-equal-weight-destructive.md', text });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /missing required section/);
});

test('an extra ## section is rejected', () => {
  const text = VALID + '\n## Extra Section\nThis should not be here.';
  const errors = validateModeFile({ filename: 'UX-014-equal-weight-destructive.md', text });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /unexpected section/);
});

test('sections in wrong order are rejected', () => {
  const text = `---
id: UX-014
title: Destructive action weighted equally with its safe sibling
category: interaction
severity: high
detection: model
appliesTo: [button-group, table-row-actions]
---
## Counter-example — when this is fine
A dedicated destructive-only screen.

## Signal
Delete rendered with the same variant as Edit.

## Why it fails
Users misfire on the irreversible option.

## Fix
Demote the destructive action.
`;
  const errors = validateModeFile({ filename: 'UX-014-equal-weight-destructive.md', text });
  assert.ok(errors.some((e) => /order/.test(e)));
});

test('indexLine renders the canonical pipe format', () => {
  const { data } = parseFrontmatter(VALID);
  assert.equal(indexLine(data), 'UX-014 | interaction | high | model | Destructive action weighted equally with its safe sibling');
});

test('checkIndex reports a mode missing from INDEX.md', () => {
  const { data } = parseFrontmatter(VALID);
  const errors = checkIndex([{ filename: 'UX-014-x.md', data }], '');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /UX-014/);
});

test('checkIndex reports an index line with no mode file', () => {
  const errors = checkIndex([], 'UX-099 | forms | low | model | Ghost entry');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /UX-099/);
});

test('checkIndex requires ID-sorted order', () => {
  const a = parseFrontmatter(VALID).data;
  const b = { ...a, id: 'UX-002', title: 'Earlier', category: 'forms', severity: 'low', detection: 'model' };
  const idx = [indexLine(a), indexLine(b)].join('\n');
  const errors = checkIndex([{ filename: 'a.md', data: a }, { filename: 'b.md', data: b }], idx);
  assert.ok(errors.some((e) => /sorted/.test(e)));
});

import { modeIndex } from '../scripts/lib/library.mjs';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';

const modesDir = fileURLToPath(new URL('../skills/failure-modes/references/', import.meta.url));

test('modeIndex maps every mode id to its metadata', () => {
  const index = modeIndex(modesDir);
  // Derived, not hardcoded: what this test claims is that every mode file on
  // disk made it into the index, and a literal count only says that until the
  // next mode is written.
  const fileCount = readdirSync(modesDir).filter((f) => /^UX-\d{3}-.*\.md$/.test(f)).length;
  assert.equal(index.size, fileCount);
  const mode = index.get('UX-101');
  assert.equal(mode.id, 'UX-101');
  assert.equal(mode.category, 'system-consistency');
  assert.ok(['high', 'medium', 'low'].includes(mode.severity));
  assert.ok(mode.title.length > 0);
  assert.ok(mode.fix.length > 0, 'fix line is the first line of the ## Fix section');
});

test('modeIndex fix line excludes the heading itself', () => {
  for (const mode of modeIndex(modesDir).values()) {
    assert.ok(!mode.fix.startsWith('#'), `${mode.id}: fix line must not be a heading`);
  }
});

test('modeIndex fix line is a whole paragraph, not a wrapped fragment', () => {
  for (const mode of modeIndex(modesDir).values()) {
    assert.match(mode.fix, /[.!?]$/, `${mode.id}: fix must end as a complete sentence, got "${mode.fix}"`);
  }
});

import { CATEGORY_RANGES, APPLIES_TO, CATEGORIES } from '../scripts/lib/library.mjs';

// A mode file body long enough to clear every section minimum, so these tests
// isolate the rule under test instead of tripping the length floors.
const pad = (n) => 'x'.repeat(n);
const bodyOf = ({ signal = pad(130), why = pad(130), fix = pad(110), counter = pad(90) } = {}) =>
  `## Signal\n${signal}\n\n## Why it fails\n${why}\n\n## Fix\n${fix}\n\n## Counter-example — when this is fine\n${counter}\n`;

const fileOf = (front, bodyOpts) => ({
  filename: `${front.id}-x.md`,
  text: `---\nid: ${front.id}\ntitle: ${front.title ?? 'A title'}\ncategory: ${front.category}\nseverity: ${front.severity ?? 'medium'}\ndetection: ${front.detection ?? 'model'}\nappliesTo: [${(front.appliesTo ?? ['table']).join(', ')}]\n---\n${bodyOf(bodyOpts)}`,
});

test('CATEGORY_RANGES covers 001-120 with no gaps or overlaps', () => {
  const covered = new Set();
  for (const [category, [lo, hi]] of Object.entries(CATEGORY_RANGES)) {
    assert.ok(CATEGORIES.includes(category), `unknown category ${category}`);
    for (let n = lo; n <= hi; n++) {
      assert.ok(!covered.has(n), `${n} claimed twice`);
      covered.add(n);
    }
  }
  assert.equal(covered.size, 120);
  for (let n = 1; n <= 120; n++) assert.ok(covered.has(n), `${n} uncovered`);
});

test('a mode whose ID falls outside its category range is rejected', () => {
  const errors = validateModeFile(fileOf({ id: 'UX-067', category: 'interaction' }));
  assert.ok(errors.some((e) => /range/.test(e)), errors.join('\n'));
});

test('a mode whose ID falls inside its category range is accepted', () => {
  assert.deepEqual(validateModeFile(fileOf({ id: 'UX-067', category: 'forms' })), []);
});

test('an appliesTo value outside the vocabulary is rejected', () => {
  const errors = validateModeFile(fileOf({ id: 'UX-067', category: 'forms', appliesTo: ['widget'] }));
  assert.ok(errors.some((e) => /widget/.test(e) && /appliesTo/.test(e)), errors.join('\n'));
});

test('APPLIES_TO has no duplicates and includes the wildcard', () => {
  assert.equal(new Set(APPLIES_TO).size, APPLIES_TO.length);
  assert.ok(APPLIES_TO.includes('any'));
});

test('a section under its minimum length is rejected', () => {
  const errors = validateModeFile(fileOf({ id: 'UX-067', category: 'forms' }, { fix: 'Fix it.' }));
  assert.ok(errors.some((e) => /Fix/.test(e) && /at least 100/.test(e)), errors.join('\n'));
});

test('generic filler in the Fix section is rejected', () => {
  const errors = validateModeFile(
    fileOf({ id: 'UX-067', category: 'forms' }, { fix: `Consider using a review step ${pad(90)}` }),
  );
  assert.ok(errors.some((e) => /consider using/i.test(e)), errors.join('\n'));
});

test('generic filler outside the Fix section is not rejected', () => {
  // The ban targets vague *remedies*. A Signal may legitimately describe code
  // that adds something "as needed" — that is a report, not a non-answer.
  assert.deepEqual(
    validateModeFile(fileOf({ id: 'UX-067', category: 'forms' }, { signal: `Rows render as needed ${pad(110)}` })),
    [],
  );
});

import { checkCrossFile, signalSimilarity } from '../scripts/lib/library.mjs';

const modeRec = (id, category, title, signal) => ({
  filename: `${id}-x.md`,
  data: { id, category, title, severity: 'medium', detection: 'model', appliesTo: ['table'] },
  body: `## Signal\n${signal}\n\n## Why it fails\ny\n\n## Fix\nz\n\n## Counter-example — when this is fine\nw\n`,
});

test('signalSimilarity is 1 for identical text and 0 for disjoint text', () => {
  assert.equal(signalSimilarity('sortable column header renders', 'sortable column header renders'), 1);
  assert.equal(signalSimilarity('sortable column header', 'zebra striping rhythm'), 0);
});

test('signalSimilarity ignores case, punctuation and stop words', () => {
  assert.equal(signalSimilarity('The sortable column header.', 'sortable column header'), 1);
});

test('two modes in one category with near-identical signals are rejected', () => {
  const a = modeRec('UX-004', 'information-architecture', 'First', 'navigation buries the primary task three levels deep behind menus');
  const b = modeRec('UX-005', 'information-architecture', 'Second', 'navigation buries the primary task three levels deep behind menus');
  assert.ok(checkCrossFile([a, b]).some((e) => /similar/.test(e)));
});

test('near-identical signals in different categories are not compared', () => {
  // Categories ask different questions of the same code. A forms mode and a
  // data-display mode can share wording about a table without either being
  // redundant; only a same-category collision means one of them is surplus.
  const a = modeRec('UX-004', 'information-architecture', 'First', 'navigation buries the primary task three levels deep behind menus');
  const b = modeRec('UX-061', 'forms', 'Second', 'navigation buries the primary task three levels deep behind menus');
  assert.deepEqual(checkCrossFile([a, b]).filter((e) => /similar/.test(e)), []);
});

test('two modes sharing a title are rejected, case-insensitively', () => {
  const a = modeRec('UX-004', 'information-architecture', 'Same Title', 'alpha beta gamma delta');
  const b = modeRec('UX-005', 'information-architecture', 'same title', 'epsilon zeta eta theta');
  assert.ok(checkCrossFile([a, b]).some((e) => /title/i.test(e)));
});

test('a duplicate id is rejected', () => {
  const a = modeRec('UX-004', 'information-architecture', 'First', 'alpha beta gamma delta');
  const b = modeRec('UX-004', 'information-architecture', 'Second', 'epsilon zeta eta theta');
  assert.ok(checkCrossFile([a, b]).some((e) => /duplicate id/.test(e)));
});
