import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { modeIndex } from '../scripts/lib/library.mjs';
import { ENVELOPE_VERSION, normalizeScannerFindings, buildEnvelope } from '../scripts/lib/findings.mjs';

const modes = modeIndex(fileURLToPath(new URL('../skills/failure-modes/references/', import.meta.url)));

const scanOutput = {
  findings: [
    { id: 'UX-101', file: 'src/Navbar.tsx', line: 42, value: '#3b7d4f', kind: 'color', nearestToken: '--primary', distance: 0.03 },
    { id: 'UX-102', file: 'src/Card.tsx', line: 7, value: '17px', kind: 'length', nearestToken: null, distance: null },
  ],
  skipped: [{ file: 'src/Legacy.tsx', reason: 'parse-error:TypeError' }],
};

test('normalizeScannerFindings copies severity and category from the mode', () => {
  const [first] = normalizeScannerFindings(scanOutput, modes);
  assert.equal(first.source, 'scanner');
  assert.equal(first.severity, modes.get('UX-101').severity);
  assert.equal(first.category, modes.get('UX-101').category);
  assert.equal(first.file, 'src/Navbar.tsx');
  assert.equal(first.line, 42);
  assert.equal(first.nearestToken, '--primary');
});

test('normalizeScannerFindings composes a message naming the nearest token', () => {
  const [first] = normalizeScannerFindings(scanOutput, modes);
  assert.equal(first.message, 'Off-system colour `#3b7d4f` — nearest token `--primary` (distance 0.03).');
});

test('normalizeScannerFindings says so when no token is near', () => {
  const [, second] = normalizeScannerFindings(scanOutput, modes);
  assert.equal(second.message, 'Off-system length `17px` — no near token; likely a genuinely new value.');
});

test('normalizeScannerFindings names a duration by its own noun', () => {
  const out = normalizeScannerFindings(
    { findings: [{ id: 'UX-103', file: 'a.tsx', line: 1, value: '220ms', kind: 'time', nearestToken: null, distance: null }], skipped: [] },
    modes,
  );
  assert.match(out[0].message, /^Off-system duration `220ms`/);
});

test('normalizeScannerFindings throws on an unknown mode id', () => {
  assert.throws(
    () => normalizeScannerFindings({ findings: [{ id: 'UX-999', file: 'a.tsx', line: 1, value: '#fff', kind: 'color', nearestToken: null, distance: null }], skipped: [] }, modes),
    /UX-999/,
  );
});

test('buildEnvelope stamps version, scope and counts', () => {
  const envelope = buildEnvelope({
    findings: normalizeScannerFindings(scanOutput, modes),
    skipped: scanOutput.skipped,
    profileHash: 'ab12',
    scope: { kind: 'path', value: 'src/' },
    exceptionsApplied: 2,
    generatedAt: '2026-09-21T00:00:00.000Z',
  });
  assert.equal(envelope.version, ENVELOPE_VERSION);
  assert.equal(envelope.generatedAt, '2026-09-21T00:00:00.000Z');
  assert.equal(envelope.profileHash, 'ab12');
  assert.deepEqual(envelope.scope, { kind: 'path', value: 'src/' });
  assert.equal(envelope.exceptionsApplied, 2);
  assert.equal(envelope.findings.length, 2);
  assert.deepEqual(envelope.skipped, scanOutput.skipped);
});

import { validateModelFindings } from '../scripts/lib/findings.mjs';

const goodRow = {
  id: 'UX-046', file: 'src/UserList.tsx', line: 18,
  evidence: 'renders rows only; no branch for an empty collection',
  message: 'List has no empty state.',
};

test('validateModelFindings accepts a well-formed row and stamps mode metadata', () => {
  const { findings, errors } = validateModelFindings([goodRow], modes);
  assert.deepEqual(errors, []);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].source, 'model');
  assert.equal(findings[0].severity, modes.get('UX-046').severity);
  assert.equal(findings[0].category, modes.get('UX-046').category);
  assert.equal(findings[0].evidence, goodRow.evidence);
});

test('validateModelFindings rejects an unknown mode id', () => {
  const { findings, errors } = validateModelFindings([{ ...goodRow, id: 'UX-999' }], modes);
  assert.deepEqual(findings, []);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /UX-999/);
});

test('validateModelFindings rejects a missing or non-string file', () => {
  assert.equal(validateModelFindings([{ ...goodRow, file: undefined }], modes).errors.length, 1);
  assert.equal(validateModelFindings([{ ...goodRow, file: 42 }], modes).errors.length, 1);
});

test('validateModelFindings rejects a non-integer line but allows null', () => {
  assert.equal(validateModelFindings([{ ...goodRow, line: 'eighteen' }], modes).errors.length, 1);
  assert.equal(validateModelFindings([{ ...goodRow, line: 0 }], modes).errors.length, 1);
  assert.deepEqual(validateModelFindings([{ ...goodRow, line: null }], modes).errors, []);
});

test('validateModelFindings requires evidence', () => {
  const { errors } = validateModelFindings([{ ...goodRow, evidence: '' }], modes);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /evidence/);
});

test('validateModelFindings rejects a severity that contradicts the mode', () => {
  const contradicting = modes.get('UX-046').severity === 'high' ? 'low' : 'high';
  const { errors } = validateModelFindings([{ ...goodRow, severity: contradicting }], modes);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /severity/);
});

test('validateModelFindings falls back to the mode title when message is absent', () => {
  const { findings } = validateModelFindings([{ ...goodRow, message: undefined }], modes);
  assert.equal(findings[0].message, modes.get('UX-046').title);
});

test('validateModelFindings rejects a non-array payload wholesale', () => {
  const { findings, errors } = validateModelFindings({ id: 'UX-046' }, modes);
  assert.deepEqual(findings, []);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /array/);
});

test('validateModelFindings reports every bad row, not just the first', () => {
  const { findings, errors } = validateModelFindings(
    [{ ...goodRow, id: 'UX-999' }, goodRow, { ...goodRow, file: undefined }],
    modes,
  );
  assert.equal(findings.length, 1);
  assert.equal(errors.length, 2);
});

import { mergeFindings, rankFindings } from '../scripts/lib/findings.mjs';

const f = (over) => ({ id: 'UX-101', source: 'scanner', severity: 'low', category: 'system-consistency', file: 'a.tsx', line: 1, message: 'm', ...over });

test('mergeFindings keeps findings that differ in id, file or line', () => {
  const merged = mergeFindings([f({})], [f({ source: 'model', id: 'UX-046', severity: 'high' })]);
  assert.equal(merged.length, 2);
});

test('mergeFindings dedupes the same id at the same file and line', () => {
  const merged = mergeFindings([f({})], [f({ source: 'model' })]);
  assert.equal(merged.length, 1);
});

test('mergeFindings prefers the scanner row on a collision', () => {
  const merged = mergeFindings([f({ nearestToken: '--primary' })], [f({ source: 'model', evidence: 'e' })]);
  assert.equal(merged[0].source, 'scanner');
  assert.equal(merged[0].nearestToken, '--primary');
});

test('mergeFindings dedupes within the model list too', () => {
  const row = f({ source: 'model', id: 'UX-046', severity: 'high' });
  assert.equal(mergeFindings([], [row, { ...row }]).length, 1);
});

test('rankFindings orders by severity, then file, then line', () => {
  const ranked = rankFindings([
    f({ severity: 'low', file: 'a.tsx', line: 2 }),
    f({ severity: 'high', file: 'z.tsx', line: 9 }),
    f({ severity: 'medium', file: 'b.tsx', line: 1 }),
    f({ severity: 'low', file: 'a.tsx', line: 1 }),
  ]);
  assert.deepEqual(
    ranked.map((x) => [x.severity, x.file, x.line]),
    [['high', 'z.tsx', 9], ['medium', 'b.tsx', 1], ['low', 'a.tsx', 1], ['low', 'a.tsx', 2]],
  );
});

test('rankFindings puts a file-level finding before the first line of the same file', () => {
  const ranked = rankFindings([f({ line: 1 }), f({ id: 'UX-102', line: null })]);
  assert.equal(ranked[0].line, null);
});

test('rankFindings does not mutate its input', () => {
  const input = [f({ severity: 'low' }), f({ severity: 'high' })];
  const copy = [...input];
  rankFindings(input);
  assert.deepEqual(input, copy);
});

import { renderReport } from '../scripts/lib/findings.mjs';

const envelopeWith = (findings, extra = {}) => buildEnvelope({
  findings: rankFindings(findings),
  skipped: [],
  profileHash: 'ab12',
  scope: { kind: 'path', value: 'src/' },
  generatedAt: '2026-09-21T00:00:00.000Z',
  ...extra,
});

test('renderReport summarises counts and scope without a timestamp', () => {
  const report = renderReport(envelopeWith([
    { ...f({}), severity: 'high', id: 'UX-046' },
    f({}),
  ]), modes);
  assert.match(report, /# UX findings/);
  assert.match(report, /scope: path `src\/`/);
  assert.match(report, /1 high · 0 medium · 1 low/);
  assert.ok(!report.includes('2026-09-21T00:00:00.000Z'), 'report must stay snapshot-stable');
});

test('renderReport groups by severity and cites file:line and the mode fix', () => {
  const report = renderReport(envelopeWith([
    { ...f({}), id: 'UX-046', severity: 'high', source: 'model', file: 'src/UserList.tsx', line: 18, evidence: 'no empty branch', message: 'List has no empty state.' },
  ]), modes);
  assert.match(report, /## High/);
  assert.match(report, /\*\*UX-046\*\* · `src\/UserList\.tsx:18` — List has no empty state\./);
  assert.match(report, /Evidence: no empty branch/);
  assert.match(report, new RegExp(`Fix: ${modes.get('UX-046').fix.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('renderReport writes a file-level finding without a line number', () => {
  const report = renderReport(envelopeWith([{ ...f({}), id: 'UX-046', severity: 'high', line: null, file: 'src/A.tsx' }]), modes);
  assert.match(report, /`src\/A\.tsx`/);
  assert.ok(!report.includes('src/A.tsx:'), 'no dangling colon for a file-level finding');
});

test('renderReport says so when there is nothing to report', () => {
  assert.match(renderReport(envelopeWith([]), modes), /No findings/);
});

test('renderReport reports exceptions applied and skipped files', () => {
  const envelope = buildEnvelope({
    findings: [], skipped: [{ file: 'src/Legacy.tsx', reason: 'parse-error:TypeError' }],
    profileHash: 'ab12', scope: { kind: 'diff', value: 'HEAD' }, exceptionsApplied: 2,
    generatedAt: '2026-09-21T00:00:00.000Z',
  });
  const report = renderReport(envelope, modes);
  assert.match(report, /scope: diff `HEAD`/);
  assert.match(report, /2 exceptions applied/);
  assert.match(report, /## Skipped/);
  assert.match(report, /`src\/Legacy\.tsx` — parse-error:TypeError/);
});
