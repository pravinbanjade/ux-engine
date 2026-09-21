import { test } from 'node:test';
import assert from 'node:assert/strict';
import { substitutionFor } from '../scripts/lib/restyle.mjs';

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
