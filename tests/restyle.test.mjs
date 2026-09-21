import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { substitutionFor, planSubstitutions } from '../scripts/lib/restyle.mjs';

const at = (lineText, value, token) => substitutionFor({
  lineText,
  column: lineText.indexOf(value) + 1,
  value,
  token,
});

test('a stylesheet declaration is substituted', () => {
  assert.deepEqual(at('  color: #3b7d4f;', '#3b7d4f', '--color-primary'), { text: 'var(--color-primary)' });
});

test('a declaration inside a CSS-in-JS template literal is substituted', () => {
  assert.deepEqual(at('  padding: 17px;', '17px', '--spacing-4'), { text: 'var(--spacing-4)' });
});

test('a quoted value in a JS style object is substituted inside its quotes', () => {
  const line = "    <div style={{ color: '#3b7d4f', padding: '17px' }}>";
  assert.deepEqual(at(line, '#3b7d4f', '--color-primary'), { text: 'var(--color-primary)' });
  assert.deepEqual(at(line, '17px', '--spacing-4'), { text: 'var(--spacing-4)' });
});

test('a literal embedded in a longer CSS value is substituted in place', () => {
  const line = "  transition: 'all 220ms ease',";
  assert.deepEqual(at(line, '220ms', '--duration-fast'), { text: 'var(--duration-fast)' });
});

test('a utility class arbitrary value is left for a human', () => {
  const line = '    <div className="bg-[#3b7d4f] p-[17px]">';
  assert.deepEqual(at(line, '#3b7d4f', '--color-primary'), { manual: true, reason: 'arbitrary-utility-value' });
  assert.deepEqual(at(line, '17px', '--spacing-4'), { manual: true, reason: 'arbitrary-utility-value' });
});

test('the context test is positional, not line-wide', () => {
  // One line, both contexts. A file-level or line-level decision would get
  // one of these two wrong whichever way it went.
  const line = `    <div className="p-[17px]" style={{ color: '#3b7d4f' }}>`;
  assert.deepEqual(at(line, '17px', '--spacing-4'), { manual: true, reason: 'arbitrary-utility-value' });
  assert.deepEqual(at(line, '#3b7d4f', '--color-primary'), { text: 'var(--color-primary)' });
});

test('a bare constant is not substituted', () => {
  assert.deepEqual(at("const BRAND = '#3b7d4f';", '#3b7d4f', '--color-primary'), { manual: true, reason: 'unsupported-context' });
});

test('a JSX prop that is not a style declaration is not substituted', () => {
  assert.deepEqual(at('      <Icon color="#3b7d4f" />', '#3b7d4f', '--color-primary'), { manual: true, reason: 'unsupported-context' });
});

test('a type annotation is not mistaken for a declaration', () => {
  assert.deepEqual(at("const pad: string = '17px';", '17px', '--spacing-4'), { manual: true, reason: 'unsupported-context' });
});

const scannerFinding = (over = {}) => ({
  id: 'UX-101', source: 'scanner', severity: 'high', category: 'system-consistency',
  file: 'src/A.tsx', line: 1, column: 1, value: '#3b7d4f',
  kind: 'color', nearestToken: '--color-primary', distance: 0.03, message: 'x',
  ...over,
});

const withRepo = (files, body) => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-restyle-'));
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test('planSubstitutions plans an edit for a literal that is still where it was', () => {
  const line = "const s = { color: '#3b7d4f' };";
  withRepo({ 'src/A.tsx': `${line}\n` }, (root) => {
    const envelope = { findings: [scannerFinding({ column: line.indexOf('#3b7d4f') + 1 })] };
    const { edits, manual, judgment } = planSubstitutions(envelope, { root });
    assert.equal(manual.length, 0);
    assert.equal(judgment.length, 0);
    assert.deepEqual(edits, [{
      id: 'UX-101', file: 'src/A.tsx', line: 1, column: line.indexOf('#3b7d4f') + 1,
      value: '#3b7d4f', token: '--color-primary', replacement: 'var(--color-primary)',
    }]);
  });
});

test('a literal that has moved is demoted rather than spliced blind', () => {
  withRepo({ 'src/A.tsx': "const s = { color: '#ffffff' };\n" }, (root) => {
    const envelope = { findings: [scannerFinding({ column: 20 })] };
    const { edits, manual } = planSubstitutions(envelope, { root });
    assert.deepEqual(edits, []);
    assert.equal(manual[0].reason, 'moved');
  });
});

test('a finding with no nearest token has nothing to substitute', () => {
  const line = "const s = { color: '#3b7d4f' };";
  withRepo({ 'src/A.tsx': `${line}\n` }, (root) => {
    const envelope = { findings: [scannerFinding({ column: line.indexOf('#3b7d4f') + 1, nearestToken: null, distance: null })] };
    const { edits, manual } = planSubstitutions(envelope, { root });
    assert.deepEqual(edits, []);
    assert.equal(manual[0].reason, 'no-token');
  });
});

test('a finding from an older run with no column is not auto-fixable', () => {
  const line = "const s = { color: '#3b7d4f' };";
  withRepo({ 'src/A.tsx': `${line}\n` }, (root) => {
    const finding = scannerFinding();
    delete finding.column;
    const { edits, manual } = planSubstitutions({ findings: [finding] }, { root });
    assert.deepEqual(edits, []);
    assert.equal(manual[0].reason, 'no-column');
  });
});

test('an unreadable file is reported, not thrown', () => {
  withRepo({ 'src/B.tsx': 'x\n' }, (root) => {
    const { edits, manual } = planSubstitutions({ findings: [scannerFinding()] }, { root });
    assert.deepEqual(edits, []);
    assert.equal(manual[0].reason, 'unreadable');
  });
});

test('model findings go to the judgment list untouched', () => {
  withRepo({ 'src/A.tsx': 'x\n' }, (root) => {
    const model = { id: 'UX-046', source: 'model', severity: 'high', category: 'state-coverage', file: 'src/A.tsx', line: 1, evidence: 'no empty branch', message: 'List has no empty state.' };
    const { edits, manual, judgment } = planSubstitutions({ findings: [model] }, { root });
    assert.deepEqual(edits, []);
    assert.deepEqual(manual, []);
    assert.deepEqual(judgment, [model]);
  });
});

test('two identical literals on one line plan two distinct edits', () => {
  const line = "const s = { padding: '17px', margin: '17px' };";
  withRepo({ 'src/A.tsx': `${line}\n` }, (root) => {
    const envelope = {
      findings: [
        scannerFinding({ id: 'UX-102', value: '17px', nearestToken: '--spacing-4', column: line.indexOf('17px') + 1 }),
        scannerFinding({ id: 'UX-102', value: '17px', nearestToken: '--spacing-4', column: line.lastIndexOf('17px') + 1 }),
      ],
    };
    const { edits } = planSubstitutions(envelope, { root });
    assert.equal(edits.length, 2);
    assert.notEqual(edits[0].column, edits[1].column);
  });
});
