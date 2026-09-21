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
Delete rendered with the same variant as Edit.

## Why it fails
Users misfire on the irreversible option.

## Fix
Demote the destructive action.

## Counter-example — when this is fine
A dedicated destructive-only screen.
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
