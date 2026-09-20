// sRGB -> OKLab, after Björn Ottosson's reference conversion.
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function linearRgbToOklab(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

const fromRgb255 = (r, g, b) => linearRgbToOklab(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));

// Parse a component that may be a number or a percentage of 255.
const parseRgbComponent = (str) => {
  if (str.endsWith('%')) return (parseFloat(str) / 100) * 255;
  return parseFloat(str);
};

// Parse a hue value, handling degrees, radians, gradians, and turns.
const parseHue = (str) => {
  const num = parseFloat(str);
  if (Number.isNaN(num)) return NaN;
  // Check more specific suffixes first (grad contains 'rad', turn contains 'r')
  if (str.endsWith('grad')) return num * 0.9;
  if (str.endsWith('turn')) return num * 360;
  if (str.endsWith('rad')) return (num * 180) / Math.PI;
  // bare number or 'deg' suffix -> degrees
  return num;
};

export function parseColor(input) {
  const str = String(input).trim().toLowerCase();

  const hex = /^#([0-9a-f]{3,8})$/.exec(str);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return fromRgb255(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
  }

  const rgb = /^rgba?\(([^)]+)\)$/.exec(str);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const r = parseRgbComponent(parts[0]);
    const g = parseRgbComponent(parts[1]);
    const b = parseRgbComponent(parts[2]);
    if ([r, g, b].some(Number.isNaN)) return null;
    return fromRgb255(r, g, b);
  }

  const hsl = /^hsla?\(([^)]+)\)$/.exec(str);
  if (hsl) {
    const parts = hsl[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const h = parseHue(parts[0]);
    const s = parts[1].endsWith('%') ? parseFloat(parts[1]) / 100 : parseFloat(parts[1]);
    const l = parts[2].endsWith('%') ? parseFloat(parts[2]) / 100 : parseFloat(parts[2]);
    if ([h, s, l].some(Number.isNaN)) return null;
    // HSL to RGB conversion
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hh = h % 360;
    const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
    const m = l - c / 2;
    let r255, g255, b255;
    if (hh < 60) [r255, g255, b255] = [c, x, 0];
    else if (hh < 120) [r255, g255, b255] = [x, c, 0];
    else if (hh < 180) [r255, g255, b255] = [0, c, x];
    else if (hh < 240) [r255, g255, b255] = [0, x, c];
    else if (hh < 300) [r255, g255, b255] = [x, 0, c];
    else [r255, g255, b255] = [c, 0, x];
    return fromRgb255((r255 + m) * 255, (g255 + m) * 255, (b255 + m) * 255);
  }

  const oklch = /^oklch\(([^)]+)\)$/.exec(str);
  if (oklch) {
    const parts = oklch[1].split(/[\s,/]+/).filter(Boolean);
    const L = parts[0].endsWith('%') ? parseFloat(parts[0]) / 100 : parseFloat(parts[0]);
    const chromaStr = parts[1];
    const C = (chromaStr.endsWith('%') ? parseFloat(chromaStr) * 0.004 : parseFloat(chromaStr));
    const hDeg = parseHue(parts[2]);
    const H = (hDeg * Math.PI) / 180;
    if ([L, C, H].some(Number.isNaN)) return null;
    return { L, a: C * Math.cos(H), b: C * Math.sin(H) };
  }

  return null;
}

export function deltaE(c1, c2) {
  if (!c1 || !c2) return Infinity;
  return Math.hypot(c1.L - c2.L, c1.a - c2.a, c1.b - c2.b);
}

const UNITS = { px: 'length', rem: 'length', em: 'length', ms: 'time', s: 'time' };

export function parseScalar(input) {
  const trimmed = String(input).trim();
  // Allow optional leading + or -, digits or leading-dot decimal, and optional unit
  const m = /^([+\-]?)(\d+(?:\.\d+)?|\.\d+)(px|rem|em|ms|s)?$/.exec(trimmed);
  if (!m) return null;
  const value = Number(m[1] + m[2]);
  const unit = m[3] || null;
  // Unitless values are only valid if exactly 0
  if (!unit && value !== 0) return null;
  return { value, unit };
}

const toBase = ({ value, unit }) => {
  // Treats rem and em as 16px unconditionally. A project with a non-16px root font size
  // will get proportionally wrong distances.
  if (unit === 'rem' || unit === 'em') return value * 16;
  if (unit === 's') return value * 1000;
  return value;
};

export function scalarDistance(candidate, reference) {
  if (!candidate || !reference) return null;
  // null unit is compatible with any unit (zero is zero in every unit)
  const candType = candidate.unit ? UNITS[candidate.unit] : null;
  const refType = reference.unit ? UNITS[reference.unit] : null;
  if (candType && refType && candType !== refType) return null;
  const candVal = toBase(candidate);
  const ref = toBase(reference);
  // Zero in any unit is always distance 0 from any compatible unit
  if (candVal === 0) return 0;
  if (ref === 0) return Infinity;
  return Math.abs(candVal - ref) / Math.abs(ref);
}
