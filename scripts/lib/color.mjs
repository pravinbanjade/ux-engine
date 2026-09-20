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
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
    return fromRgb255(parts[0], parts[1], parts[2]);
  }

  const oklch = /^oklch\(([^)]+)\)$/.exec(str);
  if (oklch) {
    const parts = oklch[1].split(/[\s,/]+/).filter(Boolean);
    const L = parts[0].endsWith('%') ? parseFloat(parts[0]) / 100 : parseFloat(parts[0]);
    const C = parseFloat(parts[1]);
    const H = (parseFloat(parts[2]) * Math.PI) / 180;
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
  const m = /^(-?\d+(?:\.\d+)?)(px|rem|em|ms|s)$/.exec(String(input).trim());
  if (!m) return null;
  return { value: Number(m[1]), unit: m[2] };
}

const toBase = ({ value, unit }) => {
  if (unit === 'rem' || unit === 'em') return value * 16;
  if (unit === 's') return value * 1000;
  return value;
};

export function scalarDistance(candidate, reference) {
  if (!candidate || !reference) return null;
  if (UNITS[candidate.unit] !== UNITS[reference.unit]) return null;
  const ref = toBase(reference);
  if (ref === 0) return toBase(candidate) === 0 ? 0 : Infinity;
  return Math.abs(toBase(candidate) - ref) / Math.abs(ref);
}
