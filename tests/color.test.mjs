import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, deltaE, parseScalar, scalarDistance } from '../scripts/lib/color.mjs';

test('parseColor reads hex', () => {
  const c = parseColor('#ffffff');
  assert.ok(Math.abs(c.L - 1) < 0.001, `L was ${c.L}`);
  assert.ok(Math.abs(c.a) < 0.001 && Math.abs(c.b) < 0.001);
});

test('parseColor reads shorthand hex identically to longhand', () => {
  assert.deepEqual(parseColor('#fff'), parseColor('#ffffff'));
});

test('parseColor reads rgb()', () => {
  assert.deepEqual(parseColor('rgb(255, 255, 255)'), parseColor('#ffffff'));
});

test('parseColor reads oklch()', () => {
  const c = parseColor('oklch(0.55 0.15 150)');
  assert.ok(Math.abs(c.L - 0.55) < 1e-9);
  assert.ok(c.a < 0, 'hue 150 is green: a should be negative');
});

test('parseColor returns null for a non-colour', () => {
  assert.equal(parseColor('inherit'), null);
});

test('deltaE is zero for identical colours', () => {
  assert.equal(deltaE(parseColor('#2f6f4f'), parseColor('#2f6f4f')), 0);
});

test('deltaE is small for near-identical colours and large for distant ones', () => {
  const near = deltaE(parseColor('#2f6f4f'), parseColor('#2f6f55'));
  const far = deltaE(parseColor('#2f6f4f'), parseColor('#ffffff'));
  assert.ok(near < 0.1, `near was ${near}`);
  assert.ok(far > 0.4, `far was ${far}`);
});

test('parseScalar reads lengths and durations', () => {
  assert.deepEqual(parseScalar('16px'), { value: 16, unit: 'px' });
  assert.deepEqual(parseScalar('1.5rem'), { value: 1.5, unit: 'rem' });
  assert.deepEqual(parseScalar('150ms'), { value: 150, unit: 'ms' });
  assert.equal(parseScalar('auto'), null);
});

test('scalarDistance normalises rem to px and s to ms', () => {
  assert.equal(scalarDistance(parseScalar('16px'), parseScalar('1rem')), 0);
  assert.equal(scalarDistance(parseScalar('1000ms'), parseScalar('1s')), 0);
});

test('scalarDistance is relative to the reference value', () => {
  assert.ok(Math.abs(scalarDistance(parseScalar('17px'), parseScalar('16px')) - 0.0625) < 1e-9);
});

test('scalarDistance refuses to compare a length with a duration', () => {
  assert.equal(scalarDistance(parseScalar('16px'), parseScalar('150ms')), null);
});
