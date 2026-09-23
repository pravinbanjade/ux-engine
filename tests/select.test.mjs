import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectModes, unknownKinds } from '../scripts/lib/select.mjs';

const mode = (id, category, appliesTo, { severity = 'medium', detection = 'model' } = {}) => ({
  filename: `${id}-x.md`,
  data: { id, title: `Title ${id}`, category, severity, detection, appliesTo },
});

const CATALOG = [
  mode('UX-046', 'state-coverage', ['list', 'table'], { severity: 'high' }),
  mode('UX-061', 'forms', ['form', 'field']),
  mode('UX-076', 'data-display', ['table'], { severity: 'low' }),
  mode('UX-101', 'system-consistency', ['any'], { severity: 'high', detection: 'scanner' }),
  mode('UX-111', 'conformance', ['generated-ui'], { severity: 'high', detection: 'conformance' }),
];

const ids = (result) => result.map((m) => m.data.id);

test('a kind matches any mode listing it', () => {
  assert.deepEqual(ids(selectModes(CATALOG, { kinds: ['form'] })), ['UX-061', 'UX-101']);
});

test('a mode with appliesTo [any] matches every kind', () => {
  // UX-101 is `any` and comes back for a kind it never names. That is the
  // point: a system-consistency failure is not scoped to a surface.
  assert.ok(ids(selectModes(CATALOG, { kinds: ['chart'] })).includes('UX-101'));
});

test('several kinds union rather than intersect', () => {
  assert.deepEqual(ids(selectModes(CATALOG, { kinds: ['list', 'field'] })), ['UX-046', 'UX-061', 'UX-101']);
});

test('omitting kinds matches every mode', () => {
  assert.equal(selectModes(CATALOG, {}).length, CATALOG.length);
});

test('categories narrow the result', () => {
  assert.deepEqual(ids(selectModes(CATALOG, { kinds: ['table'], categories: ['data-display'] })), ['UX-076']);
});

test('severities narrow the result', () => {
  assert.deepEqual(ids(selectModes(CATALOG, { kinds: ['table'], severities: ['high'] })), ['UX-046', 'UX-101']);
});

test('excludeDetections drops the named detection kinds', () => {
  assert.deepEqual(
    ids(selectModes(CATALOG, { kinds: ['table'], excludeDetections: ['scanner', 'conformance'] })),
    ['UX-046', 'UX-076'],
  );
});

test('results are sorted by id regardless of input order', () => {
  const shuffled = [CATALOG[3], CATALOG[0], CATALOG[2], CATALOG[1], CATALOG[4]];
  assert.deepEqual(ids(selectModes(shuffled, {})), ['UX-046', 'UX-061', 'UX-076', 'UX-101', 'UX-111']);
});

test('no match returns an empty array rather than throwing', () => {
  assert.deepEqual(selectModes(CATALOG, { kinds: ['avatar'], categories: ['forms'] }), []);
});

test('unknownKinds names every value outside the vocabulary', () => {
  assert.deepEqual(unknownKinds(['table', 'tables', 'widget']), ['tables', 'widget']);
  assert.deepEqual(unknownKinds(['table', 'any']), []);
});
