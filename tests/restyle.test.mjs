import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { substitutionFor, planSubstitutions, applyEdits, renderPlan } from '../scripts/lib/restyle.mjs';

const at = (lineText, value, token) => substitutionFor({
  lineText,
  column: lineText.indexOf(value) + 1,
  value,
  token,
  kind: value.startsWith('#') ? 'color' : 'length',
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
        scannerFinding({ id: 'UX-102', kind: 'length', value: '17px', nearestToken: '--spacing-4', column: line.indexOf('17px') + 1 }),
        scannerFinding({ id: 'UX-102', kind: 'length', value: '17px', nearestToken: '--spacing-4', column: line.lastIndexOf('17px') + 1 }),
      ],
    };
    const { edits } = planSubstitutions(envelope, { root });
    assert.equal(edits.length, 2);
    assert.notEqual(edits[0].column, edits[1].column);
  });
});

test('applyEdits replaces a literal in place', () => {
  const line = "const s = { color: '#3b7d4f' };";
  withRepo({ 'src/A.tsx': `${line}\n` }, (root) => {
    const edits = [{ id: 'UX-101', file: 'src/A.tsx', line: 1, column: line.indexOf('#3b7d4f') + 1, value: '#3b7d4f', token: '--color-primary', replacement: 'var(--color-primary)' }];
    const summary = applyEdits(edits, { root });
    assert.equal(summary.applied, 1);
    assert.deepEqual(summary.failed, []);
    assert.equal(readFileSync(join(root, 'src/A.tsx'), 'utf8'), "const s = { color: 'var(--color-primary)' };\n");
  });
});

test('two edits on one line both land, longest replacement first', () => {
  // Applied left-to-right the second column would be 13 characters stale.
  const line = "const s = { padding: '17px', margin: '17px' };";
  withRepo({ 'src/A.tsx': `${line}\n` }, (root) => {
    const edits = [
      { id: 'UX-102', file: 'src/A.tsx', line: 1, column: line.indexOf('17px') + 1, value: '17px', token: '--spacing-4', replacement: 'var(--spacing-4)' },
      { id: 'UX-102', file: 'src/A.tsx', line: 1, column: line.lastIndexOf('17px') + 1, value: '17px', token: '--spacing-4', replacement: 'var(--spacing-4)' },
    ];
    applyEdits(edits, { root });
    assert.equal(
      readFileSync(join(root, 'src/A.tsx'), 'utf8'),
      "const s = { padding: 'var(--spacing-4)', margin: 'var(--spacing-4)' };\n",
    );
  });
});

test('dryRun writes nothing but reports the same summary', () => {
  const line = "const s = { color: '#3b7d4f' };";
  withRepo({ 'src/A.tsx': `${line}\n` }, (root) => {
    const edits = [{ id: 'UX-101', file: 'src/A.tsx', line: 1, column: line.indexOf('#3b7d4f') + 1, value: '#3b7d4f', token: '--color-primary', replacement: 'var(--color-primary)' }];
    const summary = applyEdits(edits, { root, dryRun: true });
    assert.equal(summary.applied, 1);
    assert.equal(readFileSync(join(root, 'src/A.tsx'), 'utf8'), `${line}\n`);
  });
});

test('a multi-file plan reports one entry per file', () => {
  const a = "const s = { color: '#3b7d4f' };";
  const b = "const t = { padding: '17px' };";
  withRepo({ 'src/A.tsx': `${a}\n`, 'src/B.tsx': `${b}\n` }, (root) => {
    const summary = applyEdits([
      { id: 'UX-101', file: 'src/A.tsx', line: 1, column: a.indexOf('#3b7d4f') + 1, value: '#3b7d4f', token: '--color-primary', replacement: 'var(--color-primary)' },
      { id: 'UX-102', file: 'src/B.tsx', line: 1, column: b.indexOf('17px') + 1, value: '17px', token: '--spacing-4', replacement: 'var(--spacing-4)' },
    ], { root });
    assert.equal(summary.applied, 2);
    assert.deepEqual(summary.files.map((f) => f.file).sort(), ['src/A.tsx', 'src/B.tsx']);
  });
});

test('a file that cannot be read is named and the rest still apply', () => {
  const b = "const t = { padding: '17px' };";
  withRepo({ 'src/B.tsx': `${b}\n` }, (root) => {
    const summary = applyEdits([
      { id: 'UX-101', file: 'src/Missing.tsx', line: 1, column: 1, value: '#3b7d4f', token: '--color-primary', replacement: 'var(--color-primary)' },
      { id: 'UX-102', file: 'src/B.tsx', line: 1, column: b.indexOf('17px') + 1, value: '17px', token: '--spacing-4', replacement: 'var(--spacing-4)' },
    ], { root });
    assert.equal(summary.applied, 1);
    assert.equal(summary.failed.length, 1);
    assert.equal(summary.failed[0].file, 'src/Missing.tsx');
    assert.match(readFileSync(join(root, 'src/B.tsx'), 'utf8'), /var\(--spacing-4\)/);
  });
});

test('a file with no trailing newline keeps not having one', () => {
  const line = "const s = { color: '#3b7d4f' };";
  withRepo({ 'src/A.tsx': line }, (root) => {
    applyEdits([{ id: 'UX-101', file: 'src/A.tsx', line: 1, column: line.indexOf('#3b7d4f') + 1, value: '#3b7d4f', token: '--color-primary', replacement: 'var(--color-primary)' }], { root });
    assert.equal(readFileSync(join(root, 'src/A.tsx'), 'utf8'), "const s = { color: 'var(--color-primary)' };");
  });
});

const samplePlan = () => ({
  edits: [
    { id: 'UX-101', file: 'src/A.tsx', line: 4, column: 22, value: '#3b7d4f', token: '--color-primary', replacement: 'var(--color-primary)' },
    { id: 'UX-102', file: 'src/A.tsx', line: 4, column: 44, value: '17px', token: '--spacing-4', replacement: 'var(--spacing-4)' },
    { id: 'UX-101', file: 'src/B.tsx', line: 9, column: 10, value: '#3b7d4f', token: '--color-primary', replacement: 'var(--color-primary)' },
  ],
  manual: [
    { id: 'UX-101', file: 'src/C.tsx', line: 3, value: '#3b7d4f', nearestToken: '--color-primary', reason: 'arbitrary-utility-value' },
  ],
  judgment: [
    { id: 'UX-046', file: 'src/List.tsx', line: 18, message: 'List has no empty state.' },
  ],
});

test('renderPlan counts substitutions, manual work and judgment separately', () => {
  const out = renderPlan(samplePlan());
  assert.match(out, /3 substitutions in 2 files/);
  assert.match(out, /1 needs a human/);
  assert.match(out, /1 needs judgment/);
});

test('renderPlan groups substitutions by file and cites the exact position', () => {
  const out = renderPlan(samplePlan());
  assert.match(out, /### `src\/A\.tsx`/);
  assert.match(out, /### `src\/B\.tsx`/);
  assert.match(out, /- L4:22 `#3b7d4f` → `var\(--color-primary\)` \(UX-101\)/);
});

test('renderPlan says why each manual item was left alone, with the token to use', () => {
  const out = renderPlan(samplePlan());
  assert.match(out, /`src\/C\.tsx:3` — `#3b7d4f` → `--color-primary`: arbitrary-utility-value/);
});

test('renderPlan lists judgment findings without proposing an edit', () => {
  const out = renderPlan(samplePlan());
  assert.match(out, /\*\*UX-046\*\* · `src\/List\.tsx:18` — List has no empty state\./);
  assert.ok(!/UX-046.*→/.test(out), 'a judgment finding has no mechanical arrow');
});

test('renderPlan on an empty plan says there is nothing to do', () => {
  const out = renderPlan({ edits: [], manual: [], judgment: [] });
  assert.match(out, /Nothing to restyle\./);
});

test('renderPlan omits a section that has no rows', () => {
  const out = renderPlan({ edits: [], manual: [], judgment: [{ id: 'UX-046', file: 'src/List.tsx', line: 18, message: 'List has no empty state.' }] });
  assert.ok(!/## Substitutions/.test(out));
  assert.ok(!/## Needs a human/.test(out));
  assert.match(out, /## Needs judgment/);
});

// An API's email template held the same greys the frontend had tokens for,
// in a template literal that reads exactly like a stylesheet. `var()` there
// resolves to nothing — the token stylesheet is never loaded into an email.
test('a literal in another package from the token source is left for a human', () => {
  const css = '    body { background-color: #3b7d4f; }';
  const ui = "const s = { color: '#3b7d4f' };";
  withRepo({
    'package.json': '{}',
    'web/package.json': '{}',
    'web/src/index.css': ':root { --color-primary: #3b7d4e; }\n',
    'web/src/A.tsx': `${ui}\n`,
    'api/package.json': '{}',
    'api/prisma/seeds/email.seed.ts': `const html = \`\n${css}\n\`;\n`,
  }, (root) => {
    const envelope = { findings: [
      scannerFinding({ file: 'web/src/A.tsx', column: ui.indexOf('#3b7d4f') + 1 }),
      scannerFinding({ file: 'api/prisma/seeds/email.seed.ts', line: 2, column: css.indexOf('#3b7d4f') + 1 }),
    ] };
    const { edits, manual } = planSubstitutions(envelope, { root, tokenSource: ['web/src/index.css'] });
    assert.deepEqual(edits.map((e) => e.file), ['web/src/A.tsx']);
    assert.deepEqual(manual.map((m) => [m.file, m.reason]), [['api/prisma/seeds/email.seed.ts', 'outside-token-package']]);
  });
});

test('a single-package repo substitutes anywhere in it', () => {
  const line = "const s = { color: '#3b7d4f' };";
  withRepo({
    'package.json': '{}',
    'src/styles/tokens.css': ':root { --color-primary: #3b7d4e; }\n',
    'src/deep/nested/A.tsx': `${line}\n`,
  }, (root) => {
    const envelope = { findings: [scannerFinding({ file: 'src/deep/nested/A.tsx', column: line.indexOf('#3b7d4f') + 1 })] };
    const { edits, manual } = planSubstitutions(envelope, { root, tokenSource: ['src/styles/tokens.css'] });
    assert.equal(edits.length, 1);
    assert.deepEqual(manual, []);
  });
});

test('a repo with no package.json anywhere is one package', () => {
  const line = "const s = { color: '#3b7d4f' };";
  withRepo({
    'styles/tokens.css': ':root { --color-primary: #3b7d4e; }\n',
    'app/A.tsx': `${line}\n`,
  }, (root) => {
    const envelope = { findings: [scannerFinding({ file: 'app/A.tsx', column: line.indexOf('#3b7d4f') + 1 })] };
    const { edits } = planSubstitutions(envelope, { root, tokenSource: ['styles/tokens.css'] });
    assert.equal(edits.length, 1);
  });
});

// A colour has no property hint, so the scanner reports one wherever it is
// written. A JS constants object is declaration-shaped, and `var()` in a
// string a chart library or canvas paints resolves to nothing.
test('a colour under a key that is not a colour property is left for a human', () => {
  assert.deepEqual(at("  PRIMARY: '#1890ff',", '#1890ff', '--color-primary'), { manual: true, reason: 'unsupported-context' });
  assert.deepEqual(at("const theme = { brand: '#1890ff' };", '#1890ff', '--color-primary'), { manual: true, reason: 'unsupported-context' });
});

test('a colour under a colour property is substituted in either spelling', () => {
  assert.deepEqual(at("  backgroundColor: '#3b7d4f',", '#3b7d4f', '--c'), { text: 'var(--c)' });
  assert.deepEqual(at('  border-left-color: #3b7d4f;', '#3b7d4f', '--c'), { text: 'var(--c)' });
  assert.deepEqual(at('  box-shadow: 0 1px 2px #3b7d4f;', '#3b7d4f', '--c'), { text: 'var(--c)' });
  assert.deepEqual(at('<circle style={{ fill: "#3b7d4f" }} />', '#3b7d4f', '--c'), { text: 'var(--c)' });
});

test('console styling is left for a human', () => {
  const line = "    console.group(`%c[ERROR] ${message}`, 'color: #ff4d4f; font-weight: bold;');";
  assert.deepEqual(at(line, '#ff4d4f', '--c'), { manual: true, reason: 'unsupported-context' });
});

// A PDF renderer's StyleSheet uses real colour property names, and `var()`
// in it prints nothing. The renderer is named in the file's imports.
test('a file rendered outside the DOM is left for a human', () => {
  const pdf = "  heading: { color: '#3b7d4f' },";
  const native = "const s = StyleSheet.create({ box: { backgroundColor: '#3b7d4f' } });";
  const dom = "const s = { color: '#3b7d4f' };";
  withRepo({
    'src/Report.tsx': `import { Document, StyleSheet } from '@react-pdf/renderer';\nconst styles = StyleSheet.create({\n${pdf}\n});\n`,
    'src/Box.tsx': `import { StyleSheet } from 'react-native';\n${native}\n`,
    'src/Web.tsx': `import React from 'react';\n${dom}\n`,
  }, (root) => {
    const envelope = { findings: [
      scannerFinding({ file: 'src/Report.tsx', line: 3, column: pdf.indexOf('#3b7d4f') + 1 }),
      scannerFinding({ file: 'src/Box.tsx', line: 2, column: native.indexOf('#3b7d4f') + 1 }),
      scannerFinding({ file: 'src/Web.tsx', line: 2, column: dom.indexOf('#3b7d4f') + 1 }),
    ] };
    const { edits, manual } = planSubstitutions(envelope, { root });
    assert.deepEqual(edits.map((e) => e.file), ['src/Web.tsx']);
    assert.deepEqual(manual.map((m) => [m.file, m.reason]), [
      ['src/Report.tsx', 'non-dom-renderer'],
      ['src/Box.tsx', 'non-dom-renderer'],
    ]);
  });
});

test('a package whose name only starts like a renderer is not one', () => {
  const dom = "const s = { color: '#3b7d4f' };";
  withRepo({
    'src/A.tsx': `import { inkBlot } from 'inkwell';\n${dom}\n`,
  }, (root) => {
    const envelope = { findings: [scannerFinding({ file: 'src/A.tsx', line: 2, column: dom.indexOf('#3b7d4f') + 1 })] };
    assert.equal(planSubstitutions(envelope, { root }).edits.length, 1);
  });
});
