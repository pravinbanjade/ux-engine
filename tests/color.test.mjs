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

test('parseColor reads rgb with percentage components', () => {
  assert.deepEqual(parseColor('rgb(100%, 100%, 100%)'), parseColor('#ffffff'));
  assert.deepEqual(parseColor('rgb(50%, 50%, 50%)'), parseColor('rgb(127.5, 127.5, 127.5)'));
});

test('parseColor reads oklch()', () => {
  const c = parseColor('oklch(0.55 0.15 150)');
  assert.ok(Math.abs(c.L - 0.55) < 1e-9);
  assert.ok(c.a < 0, 'hue 150 is green: a should be negative');
});

test('parseColor reads oklch with percentage chroma', () => {
  const bare = parseColor('oklch(0.7 0.15 150)');
  const pct = parseColor('oklch(0.7 37.5% 150)');
  assert.ok(Math.abs(bare.L - pct.L) < 1e-9);
  assert.ok(Math.abs(bare.a - pct.a) < 1e-9);
  assert.ok(Math.abs(bare.b - pct.b) < 1e-9);
});

test('parseColor reads oklch with hue units', () => {
  const deg = parseColor('oklch(0.55 0.15 150)');
  const rad = parseColor('oklch(0.55 0.15 2.617993877991494rad)');
  const grad = parseColor('oklch(0.55 0.15 166.66666666666666grad)');
  const turn = parseColor('oklch(0.55 0.15 0.4166666666666667turn)');
  [rad, grad, turn].forEach(c => {
    assert.ok(Math.abs(c.L - deg.L) < 1e-5);
    assert.ok(Math.abs(c.a - deg.a) < 1e-5);
    assert.ok(Math.abs(c.b - deg.b) < 1e-5);
  });
});

test('parseColor reads hsl()', () => {
  const hsl = parseColor('hsl(150 40% 30%)');
  const rgb = parseColor('rgb(46, 107, 77)');
  // HSL to RGB conversion involves rounding, so use slightly looser tolerance
  assert.ok(Math.abs(hsl.L - rgb.L) < 0.001);
  assert.ok(Math.abs(hsl.a - rgb.a) < 0.001);
  assert.ok(Math.abs(hsl.b - rgb.b) < 0.001);
});

test('parseColor reads hsla() with alpha', () => {
  const hsla = parseColor('hsla(150 40% 30% / 0.5)');
  const hsl = parseColor('hsl(150 40% 30%)');
  assert.ok(Math.abs(hsla.L - hsl.L) < 1e-9);
  assert.ok(Math.abs(hsla.a - hsl.a) < 1e-9);
  assert.ok(Math.abs(hsla.b - hsl.b) < 1e-9);
});

test('parseColor returns null for a non-colour', () => {
  assert.equal(parseColor('inherit'), null);
});

test('parseColor returns null for oklch() with too few arguments (arity guard)', () => {
  assert.equal(parseColor('oklch(0.5)'), null);
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

test('deltaE returns Infinity for unparseable colour', () => {
  assert.equal(deltaE(parseColor('inherit'), parseColor('#ffffff')), Infinity);
  assert.equal(deltaE(parseColor('#ffffff'), null), Infinity);
});

test('parseScalar reads lengths and durations', () => {
  assert.deepEqual(parseScalar('16px'), { value: 16, unit: 'px' });
  assert.deepEqual(parseScalar('1.5rem'), { value: 1.5, unit: 'rem' });
  assert.deepEqual(parseScalar('150ms'), { value: 150, unit: 'ms' });
  assert.equal(parseScalar('auto'), null);
});

test('parseScalar reads leading-dot decimals', () => {
  assert.deepEqual(parseScalar('.5rem'), { value: 0.5, unit: 'rem' });
  assert.deepEqual(parseScalar('.75px'), { value: 0.75, unit: 'px' });
});

test('parseScalar reads optional leading plus sign', () => {
  assert.deepEqual(parseScalar('+16px'), { value: 16, unit: 'px' });
  assert.deepEqual(parseScalar('+1.5rem'), { value: 1.5, unit: 'rem' });
});

test('parseScalar accepts unitless zero', () => {
  assert.deepEqual(parseScalar('0'), { value: 0, unit: null });
});

test('parseScalar rejects non-zero unitless values', () => {
  assert.equal(parseScalar('1'), null);
  assert.equal(parseScalar('0.5'), null);
});

test('scalarDistance normalises rem to px and s to ms', () => {
  assert.equal(scalarDistance(parseScalar('16px'), parseScalar('1rem')), 0);
  assert.equal(scalarDistance(parseScalar('1000ms'), parseScalar('1s')), 0);
});

test('scalarDistance is relative to the reference value', () => {
  assert.ok(Math.abs(scalarDistance(parseScalar('17px'), parseScalar('16px')) - 0.0625) < 1e-9);
});

test('scalarDistance treats unitless zero as compatible with any unit', () => {
  assert.equal(scalarDistance(parseScalar('0'), parseScalar('16px')), 0);
  assert.equal(scalarDistance(parseScalar('0'), parseScalar('1rem')), 0);
  assert.equal(scalarDistance(parseScalar('0'), parseScalar('100ms')), 0);
});

test('scalarDistance returns Infinity for zero reference with non-zero candidate', () => {
  assert.equal(scalarDistance(parseScalar('16px'), parseScalar('0px')), Infinity);
  assert.equal(scalarDistance(parseScalar('1rem'), parseScalar('0px')), Infinity);
});

test('scalarDistance returns zero when both are zero', () => {
  assert.equal(scalarDistance(parseScalar('0'), parseScalar('0px')), 0);
});

test('scalarDistance refuses to compare a length with a duration', () => {
  assert.equal(scalarDistance(parseScalar('16px'), parseScalar('150ms')), null);
});

test('parseScalar accepts negative values', () => {
  assert.deepEqual(parseScalar('-4px'), { value: -4, unit: 'px' });
  assert.deepEqual(parseScalar('-0.5rem'), { value: -0.5, unit: 'rem' });
  assert.deepEqual(parseScalar('-.5rem'), { value: -0.5, unit: 'rem' });
  assert.deepEqual(parseScalar('-100ms'), { value: -100, unit: 'ms' });
});

test('parseScalar accepts unitless zero including -0', () => {
  const result = parseScalar('-0');
  assert.equal(result.unit, null);
  // -0 and 0 are both acceptable; both have value 0
  assert.equal(result.value === 0 || result.value === -0, true);
});

test('parseScalar rejects non-zero negative unitless values', () => {
  assert.equal(parseScalar('-5'), null);
  assert.equal(parseScalar('-0.5'), null);
});

test('parseScalar rejects malformed values', () => {
  assert.equal(parseScalar('1.2.3px'), null);
  assert.equal(parseScalar('-'), null);
});

test('scalarDistance handles negative candidate against positive reference', () => {
  // -4px vs 16px: |(-4) - 16| / |16| = 20/16 = 1.25
  // This represents a 125% difference (candidate is 20px away from reference)
  assert.ok(Math.abs(scalarDistance(parseScalar('-4px'), parseScalar('16px')) - 1.25) < 1e-9);

  // -10px vs -20px: |(-10) - (-20)| / |(-20)| = 10/20 = 0.5
  // This represents a 50% difference
  assert.ok(Math.abs(scalarDistance(parseScalar('-10px'), parseScalar('-20px')) - 0.5) < 1e-9);
});

test('parseColor carries the alpha channel', () => {
  assert.equal(parseColor('#ffffff').alpha, 1);
  assert.equal(parseColor('rgba(255, 255, 255, 0.08)').alpha, 0.08);
  assert.equal(parseColor('rgba(38, 64, 139, 0.5)').alpha, 0.5);
  assert.equal(parseColor('#26408b80').alpha, 128 / 255);
  assert.equal(parseColor('hsla(0, 0%, 100%, 0.5)').alpha, 0.5);
});

test('deltaE refuses to compare colours of different opacity', () => {
  // Found by the restyle dogfood: rgba(255,255,255,0.08) matched
  // --background (opaque white) at distance 0, so a translucent glass
  // panel would have been substituted with a solid white block. Two
  // colours that differ only in alpha are not near each other — they are
  // different colours, and one cannot stand in for the other.
  const translucent = parseColor('rgba(255, 255, 255, 0.08)');
  const opaque = parseColor('#ffffff');
  assert.equal(deltaE(translucent, opaque), Infinity);
  assert.equal(deltaE(opaque, opaque), 0);
  assert.equal(deltaE(translucent, parseColor('rgba(255, 255, 255, 0.08)')), 0);
});
