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

test('mergeFindings keeps two distinct literals reported on the same line', () => {
  // One line can hold several off-system values — `boxShadow: '0 20px 60px
  // -15px rgba(...)'` is four. Keying dedupe on id|file|line alone threw
  // 15% of the scanner's output away on a real repo.
  const merged = mergeFindings([
    f({ value: 'rgba(38, 64, 139, 0.3)', kind: 'color', nearestToken: '--navy' }),
    f({ value: 'rgba(0,0,0,0.05)', kind: 'color', nearestToken: null }),
  ], []);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map((x) => x.value).sort(), ['rgba(0,0,0,0.05)', 'rgba(38, 64, 139, 0.3)']);
});

test('mergeFindings still collapses the identical literal reported twice', () => {
  const row = f({ value: '17px', kind: 'length' });
  assert.equal(mergeFindings([row, { ...row }], []).length, 1);
});

test('mergeFindings drops a model row the scanner already measured at that spot', () => {
  const merged = mergeFindings(
    [f({ value: '#3b7d4f', kind: 'color', nearestToken: '--primary' })],
    [f({ source: 'model', evidence: 'hardcoded brand colour' })],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].source, 'scanner');
});

test('normalizeScannerFindings carries the column through', () => {
  const scan = {
    findings: [{ id: 'UX-101', file: 'src/A.tsx', line: 4, column: 22, value: '#3b7d4f', kind: 'color', nearestToken: '--primary', distance: 0.03 }],
  };
  const [finding] = normalizeScannerFindings(scan, modes);
  assert.equal(finding.column, 22);
});

test('a scanner row without a column stays valid and simply has none', () => {
  // A findings file written by an older run is still a findings file. It
  // is just not auto-fixable, which planSubstitutions decides, not this.
  const scan = {
    findings: [{ id: 'UX-101', file: 'src/A.tsx', line: 4, value: '#3b7d4f', kind: 'color', nearestToken: '--primary', distance: 0.03 }],
  };
  const [finding] = normalizeScannerFindings(scan, modes);
  assert.equal(finding.column, undefined);
  assert.equal(finding.id, 'UX-101');
});

test('buildEnvelope defaults suppressed to an empty array', () => {
  const envelope = buildEnvelope({ findings: [], profileHash: 'ab', scope: { kind: 'path', value: '.' } });
  assert.deepEqual(envelope.suppressed, []);
});

test('buildEnvelope stamps the suppressions it was given', () => {
  const suppressed = [{ id: 'UX-102', groups: ['spacing'], distinctValues: 2, count: 775 }];
  const envelope = buildEnvelope({ findings: [], profileHash: 'ab', scope: { kind: 'path', value: '.' }, suppressed });
  assert.deepEqual(envelope.suppressed, suppressed);
});

test('renderReport names each suppression with its count', () => {
  const envelope = buildEnvelope({
    findings: [],
    profileHash: 'ab',
    scope: { kind: 'path', value: '.' },
    suppressed: [{ id: 'UX-102', groups: ['spacing', 'radius', 'type'], distinctValues: 2, count: 775 }],
  });
  const report = renderReport(envelope, modes);
  assert.match(report, /## Suppressed/);
  assert.match(report, /UX-102 suppressed for spacing\|radius\|type — 2 distinct values, not a scale \(775 literals\)/);
  assert.match(report, /1 suppressed/, 'the summary line carries the count');
});

test('renderReport omits the suppressed section when there is nothing to say', () => {
  const envelope = buildEnvelope({ findings: [], profileHash: 'ab', scope: { kind: 'path', value: '.' } });
  assert.ok(!/## Suppressed/.test(renderReport(envelope, modes)));
});

test('two identical literals at different columns on one line are both kept', () => {
  // Found by the restyle dogfood: `box-shadow: 0 10px 10px -5px rgba(...)`
  // produced two UX-102 rows that the dedupe key collapsed into one, so
  // the fixer repaired the second and left the first, and verification
  // rightly failed. Now that a scanner row carries its column, the key has
  // to include it — the same value in two places is two findings.
  const a = {
    id: 'UX-102', source: 'scanner', severity: 'medium', category: 'system-consistency',
    file: 'src/styles/a.css', line: 70, column: 52, value: '10px', message: 'm',
  };
  const b = { ...a, column: 57 };
  assert.equal(mergeFindings([a, b], []).length, 2);
});

test('the same literal at the same column is still one finding', () => {
  const a = {
    id: 'UX-102', source: 'scanner', severity: 'medium', category: 'system-consistency',
    file: 'src/styles/a.css', line: 70, column: 52, value: '10px', message: 'm',
  };
  assert.equal(mergeFindings([a, { ...a }], []).length, 1);
});

test('an unusable-scale suppression renders the sentence it always rendered', () => {
  const envelope = buildEnvelope({
    generatedAt: '2026-09-24T00:00:00.000Z',
    profileHash: 'abc',
    scope: { kind: 'path', value: 'src/' },
    findings: [],
    suppressed: [{ id: 'UX-102', reason: 'unusable-scale', groups: ['spacing'], distinctValues: 2, count: 23 }],
  });
  const report = renderReport(envelope);
  assert.match(report, /UX-102 suppressed for spacing — 2 distinct values, not a scale \(23 literals\)/);
});

test('a suppression entry written before reason existed still renders', () => {
  // report-findings.mjs can be pointed at a findings file from an older build.
  // The entry has no `reason`; the renderer must fall back to the shape it has
  // rather than print "undefined" or throw.
  const envelope = buildEnvelope({
    generatedAt: '2026-09-24T00:00:00.000Z',
    profileHash: 'abc',
    scope: { kind: 'path', value: 'src/' },
    findings: [],
    suppressed: [{ id: 'UX-103', groups: ['motion'], distinctValues: 0, count: 13 }],
  });
  const report = renderReport(envelope);
  assert.match(report, /UX-103 suppressed for motion — 0 distinct values, not a scale \(13 literals\)/);
  assert.ok(!report.includes('undefined'), report);
});

test('a no-context suppression renders its own sentence with no undefined', () => {
  const envelope = buildEnvelope({
    generatedAt: '2026-09-24T00:00:00.000Z',
    profileHash: 'abc',
    scope: { kind: 'path', value: 'src/' },
    findings: [],
    suppressed: [{ id: 'UX-102', reason: 'no-context', count: 69 }],
  });
  const report = renderReport(envelope);
  assert.match(report, /UX-102 suppressed for 69 length\(s\) whose surrounding code does not say which token group/);
  assert.ok(!report.includes('undefined'), report);
  assert.ok(!report.includes('not a scale'), 'no-context must not borrow the unusable-scale sentence');
});

test('the no-context sentence does not claim a cause it cannot know', () => {
  // The entry carries a count and nothing else. Naming shadows and filters
  // tells a reader whose paddingTop literal was suppressed that the line is
  // not about them, which is the opposite of what a suppression line is for.
  const envelope = buildEnvelope({
    generatedAt: '2026-09-24T00:00:00.000Z',
    profileHash: 'abc',
    scope: { kind: 'path', value: 'src/' },
    findings: [],
    suppressed: [{ id: 'UX-102', reason: 'no-context', count: 69 }],
  });
  const report = renderReport(envelope);
  for (const claim of ['shadow', 'filter', 'border width']) {
    assert.ok(!report.toLowerCase().includes(claim), `must not assert "${claim}" as the cause: ${report}`);
  }
  assert.match(report, /69/);
});

test('a suppression that carries literals shows them under its line', () => {
  // The line above it says the scale is too thin. This is the first thing in
  // the report a reader can act on: the values their own code already uses,
  // which are the raw material for the scale the line is asking for.
  const envelope = buildEnvelope({
    findings: [],
    profileHash: 'ab',
    scope: { kind: 'path', value: '.' },
    suppressed: [{
      id: 'UX-102',
      reason: 'unusable-scale',
      groups: ['spacing'],
      distinctValues: 2,
      count: 321,
      distinctLiterals: 19,
      values: [{ value: '24px', count: 22 }, { value: '1rem', count: 18 }, { value: '8px', count: 1 }],
    }],
  });
  const report = renderReport(envelope, modes);
  assert.match(report, /Most used: `24px` \(×22\), `1rem` \(×18\), `8px` \(×1\) — 16 more not shown/);
  assert.match(report, /raw material for a spacing scale/);
});

test('a suppression showing every literal it found says nothing about more', () => {
  const envelope = buildEnvelope({
    findings: [],
    profileHash: 'ab',
    scope: { kind: 'path', value: '.' },
    suppressed: [{
      id: 'UX-102',
      reason: 'unusable-scale',
      groups: ['spacing'],
      distinctValues: 2,
      count: 3,
      distinctLiterals: 2,
      values: [{ value: '24px', count: 2 }, { value: '8px', count: 1 }],
    }],
  });
  assert.ok(!/more not shown/.test(renderReport(envelope, modes)));
});

test('a suppression written before literals were kept still renders', () => {
  // An older .ux-engine/findings.json has no `values` key. Reading one must
  // produce the line it always produced, not a report with the word
  // "undefined" in it.
  const envelope = buildEnvelope({
    findings: [],
    profileHash: 'ab',
    scope: { kind: 'path', value: '.' },
    suppressed: [{ id: 'UX-102', reason: 'unusable-scale', groups: ['spacing'], distinctValues: 2, count: 775 }],
  });
  const report = renderReport(envelope, modes);
  assert.match(report, /UX-102 suppressed for spacing — 2 distinct values, not a scale \(775 literals\)/);
  assert.ok(!/Most used/.test(report));
  assert.ok(!/undefined/.test(report));
});
