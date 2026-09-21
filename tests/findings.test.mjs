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
