import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, validateIntent, INTENT_KEYS, WIREFRAME_VERSION } from '../scripts/lib/wireframe.mjs';

const GOOD_INTENT = {
  who: 'Risk analysts who already know the portfolio names',
  cadence: 'Several times an hour during the morning close',
  primaryAction: 'Run a fresh report against the selected portfolio',
  failure: 'The run times out and the analyst has to explain the gap',
  scale: 'Four hundred rows on a bad day, twelve on a normal one',
};

test('slugify lowercases and hyphenates', () => {
  assert.equal(slugify('Risk Report List'), 'risk-report-list');
});

test('slugify collapses runs of punctuation and trims the edges', () => {
  assert.equal(slugify('  --Risk / Report:: list!! '), 'risk-report-list');
});

test('slugify truncates to 60 characters without leaving a trailing hyphen', () => {
  const slug = slugify(`${'a'.repeat(59)} b`);
  assert.ok(slug.length <= 60);
  assert.ok(!slug.endsWith('-'), `trailing hyphen in "${slug}"`);
});

test('slugify returns an empty string when nothing survives', () => {
  assert.equal(slugify('///'), '');
  assert.equal(slugify(''), '');
  assert.equal(slugify(undefined), '');
});

test('a complete intent produces no errors', () => {
  assert.deepEqual(validateIntent(GOOD_INTENT), []);
});

test('every missing key is named', () => {
  const errors = validateIntent({});
  assert.equal(errors.length, INTENT_KEYS.length);
  for (const key of INTENT_KEYS) {
    assert.ok(errors.some((e) => e.startsWith(`intent.${key}:`)), `no error for ${key}`);
  }
});

test('a placeholder answer is rejected as a placeholder, not as a short answer', () => {
  const errors = validateIntent({ ...GOOD_INTENT, cadence: 'TBD' });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^intent\.cadence: /);
  assert.match(errors[0], /placeholder/);
});

test('every non-answer spelling is caught, case-insensitively', () => {
  for (const value of ['n/a', 'N/A', 'na', 'tbd', 'TODO', 'unknown', 'none', '?', '-']) {
    const errors = validateIntent({ ...GOOD_INTENT, who: value });
    assert.equal(errors.length, 1, `"${value}" was accepted`);
    assert.match(errors[0], /placeholder/, `"${value}" was not read as a placeholder`);
  }
});

test('an answer shorter than twelve characters is rejected', () => {
  const errors = validateIntent({ ...GOOD_INTENT, who: 'Analysts' });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /too short/);
});

test('a twelve-character answer is accepted — the floor proves a field was filled in, nothing more', () => {
  assert.deepEqual(validateIntent({ ...GOOD_INTENT, who: 'Risk analyst' }), []);
});

test('a non-string answer is not answered', () => {
  const errors = validateIntent({ ...GOOD_INTENT, scale: 400 });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /not answered/);
});

test('the prefix is configurable so the caller controls the error namespace', () => {
  assert.deepEqual(validateIntent({}, 'draft.intent').map((e) => e.split(':')[0]).sort(), [
    'draft.intent.cadence', 'draft.intent.failure', 'draft.intent.primaryAction',
    'draft.intent.scale', 'draft.intent.who',
  ]);
});

test('a non-object intent is one error, not five', () => {
  assert.deepEqual(validateIntent(null), ['intent: must be an object']);
  assert.deepEqual(validateIntent([]), ['intent: must be an object']);
});

test('the wireframe schema version is 1', () => {
  assert.equal(WIREFRAME_VERSION, 1);
});
