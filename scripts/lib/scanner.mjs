import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { walkFiles } from './detect.mjs';
import { parseColor, deltaE, parseScalar, scalarDistance } from './color.mjs';

export const DEFAULT_THRESHOLDS = { color: 0.10, scalar: 0.15 };

const SCAN_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte', '.css'];

// A number, optionally signed, with an optional decimal part — including a
// leading-dot decimal (".5") — the same shapes color.mjs's parseScalar
// resolves. No bare/unitless form is included: an unsuffixed number is far
// too common in ordinary code to treat as a literal design value.
const NUMBER = String.raw`[+-]?(?:\d+\.\d+|\.\d+|\d+)`;
// (?<![\w.]) / (?!\w) stand in for \b at a boundary that may be a '.' (so a
// leading-dot decimal like ".5rem" is still found), without matching a
// number embedded inside a longer identifier or number.
const NOT_BEFORE = String.raw`(?<![\w.])`;
const NOT_AFTER = String.raw`(?!\w)`;

const PATTERNS = [
  { kind: 'color', re: /#[0-9a-fA-F]{3,8}\b/g },
  { kind: 'color', re: /\b(?:rgba?|hsla?|oklch|oklab)\([^)]*\)/g },
  { kind: 'length', re: new RegExp(`${NOT_BEFORE}${NUMBER}(?:px|rem|em)${NOT_AFTER}`, 'g') },
  { kind: 'time', re: new RegExp(`${NOT_BEFORE}${NUMBER}m?s${NOT_AFTER}`, 'g') },
];

const KIND_TO_ID = { color: 'UX-101', length: 'UX-102', time: 'UX-103' };
const KIND_TO_GROUPS = { color: ['color'], length: ['spacing', 'radius', 'type'], time: ['motion'] };

export function findLiterals(text) {
  const out = [];
  text.split('\n').forEach((raw, index) => {
    if (raw.includes('ux-engine-ignore')) return;
    // A line that only references tokens is on-system by construction.
    const line = raw.replace(/var\(--[A-Za-z0-9_-]+\)/g, '');
    for (const { kind, re } of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) out.push({ line: index + 1, value: m[0], kind });
    }
  });
  return out.sort((a, b) => a.line - b.line);
}

export function nearestToken(literal, tokens, thresholds) {
  let best = null;
  for (const [name, value] of Object.entries(tokens)) {
    let distance = null;
    if (literal.kind === 'color') {
      const a = parseColor(literal.value);
      const b = parseColor(value);
      if (a && b) distance = deltaE(a, b);
      if (distance !== null && distance > thresholds.color) distance = null;
    } else {
      distance = scalarDistance(parseScalar(literal.value), parseScalar(value));
      if (distance !== null && distance > thresholds.scalar) distance = null;
    }
    if (distance !== null && (best === null || distance < best.distance)) best = { token: name, distance };
  }
  return best;
}

export function scanRepo(root, profile, { path = null, thresholds = DEFAULT_THRESHOLDS } = {}) {
  const findings = [];
  const skipped = [];
  const excluded = new Set(profile.styling.tokenSource ?? []);
  const scope = path ?? '';

  for (const file of walkFiles(root, SCAN_EXTENSIONS)) {
    if (excluded.has(file)) continue;
    if (scope && !file.startsWith(scope)) continue;

    let text;
    try {
      text = readFileSync(join(root, file), 'utf8');
    } catch (error) {
      skipped.push({ file, reason: error.code ?? 'read-error' });
      continue;
    }

    for (const literal of findLiterals(text)) {
      const candidates = {};
      for (const group of KIND_TO_GROUPS[literal.kind]) Object.assign(candidates, profile.tokens[group] ?? {});
      const hit = nearestToken(literal, candidates, thresholds);
      findings.push({
        id: KIND_TO_ID[literal.kind],
        file,
        line: literal.line,
        value: literal.value,
        kind: literal.kind,
        nearestToken: hit?.token ?? null,
        distance: hit?.distance ?? null,
      });
    }
  }
  return { findings, skipped };
}
