import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { extractCustomProperties, groupTokens, TOKEN_KINDS } from './tokens.mjs';
import { readManifest, detectStyling, detectComponents, detectConventions } from './detect.mjs';

export const SCHEMA_VERSION = 1;

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function scoreConfidence(profile) {
  const tokenCount = TOKEN_KINDS.reduce((n, k) => n + Object.keys(profile.tokens[k] ?? {}).length, 0);

  let styling = 'low';
  if (profile.styling.system && tokenCount >= 5) styling = 'high';
  else if (profile.styling.system) styling = 'medium';

  let components = 'low';
  if (profile.components.dir && profile.components.library) components = 'high';
  else if (profile.components.dir) components = 'medium';

  let conventions = 'low';
  if (profile.conventions.framework && profile.conventions.testRunner) conventions = 'high';
  else if (profile.conventions.framework) conventions = 'medium';

  return { styling, components, conventions };
}

// The only fields a human can ever answer through `resolvedByHuman` /
// `overrides`. Anything else — in particular `derivedFrom`, which staleness
// detection depends on being computed fresh every time, and anything
// touching the prototype chain — is not on this list and must be rejected
// by callers before it ever reaches buildProfile.
export const RESOLVABLE_FIELDS = new Set([
  'styling.system',
  'styling.tokenSource',
  'styling.tokenSyntax',
  'styling.utilityFirst',
  'components.dir',
  'components.library',
  'components.variantMechanism',
  'components.primitives',
  'conventions.framework',
  'conventions.router',
  'conventions.testRunner',
  'conventions.iconSet',
  'conventions.a11yTarget',
  'tokens',
  ...TOKEN_KINDS.map((kind) => `tokens.${kind}`),
]);

// A dotted path containing any of these segments can walk onto the
// prototype chain: `cur['__proto__']` (or `.prototype` / `.constructor`) on
// a plain object literal resolves through inherited accessors rather than
// an own property, so a naive "is this already an object?" check does not
// catch it. Any path containing one of these segments is refused outright,
// not partially applied.
const DANGEROUS_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function hasDangerousSegment(path) {
  return path.split('.').some((segment) => DANGEROUS_SEGMENTS.has(segment));
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

// Reads a dotted path ("components.dir") off an object. Refuses outright —
// returning undefined without touching the object — if any segment is
// __proto__, prototype or constructor.
export function getPath(obj, path) {
  if (hasDangerousSegment(path)) return undefined;
  return path.split('.').reduce((cur, key) => (cur == null ? undefined : cur[key]), obj);
}

// Sets a dotted path ("components.variantMechanism") on an object, creating
// intermediate objects as needed. Refuses outright — writing nothing — if
// any segment is __proto__, prototype or constructor. Returns whether the
// write happened, so a caller can tell a refusal from a successful write.
export function setPath(obj, path, value) {
  if (hasDangerousSegment(path)) return false;
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (typeof cur[key] !== 'object' || cur[key] === null) cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
  return true;
}

// buildProfile is a pure function of (root, now, overrides): it never reads
// `.ux-engine/profile.json` itself. `overrides` is a plain map of dotted
// field path to value — the caller's job (see detect-profile.mjs) is to read
// any existing profile, pull the paths it recorded in `resolvedByHuman`, and
// pass their current values back in here so a human answer survives
// re-detection instead of being silently overwritten. With no overrides,
// this produces exactly what it always has.
export function buildProfile(root, { now = new Date().toISOString(), overrides = {} } = {}) {
  const manifest = readManifest(root);
  const deps = manifest?.deps ?? {};

  const styling = detectStyling(root, deps);
  const components = detectComponents(root, deps);
  const conventions = detectConventions(deps);

  // Defence in depth: callers (see detect-profile.mjs) are expected to have
  // already filtered `overrides` against RESOLVABLE_FIELDS, but buildProfile
  // never trusts that blindly — a dotted path is dropped here too, before
  // it can reach setPath or influence which confidence group gets bumped.
  const safeOverrides = {};
  for (const [path, value] of Object.entries(overrides)) {
    if (hasDangerousSegment(path)) {
      console.warn(`ux-engine: refusing override path "${path}" (touches __proto__/prototype/constructor)`);
      continue;
    }
    safeOverrides[path] = value;
  }

  // A wrongly-typed styling.tokenSource would otherwise make the loop below
  // iterate a string's characters and call readFileSync on each one — a bad
  // hand edit becoming a hard crash. Ignore it and fall back to detection.
  if ('styling.tokenSource' in safeOverrides && !isStringArray(safeOverrides['styling.tokenSource'])) {
    console.warn('ux-engine: ignoring styling.tokenSource override — expected an array of strings, using detected value');
    delete safeOverrides['styling.tokenSource'];
  }

  // A human-corrected token source takes effect immediately: it changes
  // which files get scanned for tokens and which files this profile
  // depends on for staleness checks, not just the recorded field.
  const tokenSource = safeOverrides['styling.tokenSource'] ?? styling.tokenSource;

  let props = {};
  for (const file of tokenSource) {
    props = { ...props, ...extractCustomProperties(readFileSync(join(root, file), 'utf8')) };
  }
  const tokens = groupTokens(props);

  const sourcePaths = ['package.json', 'components.json', ...tokenSource].filter((p) => existsSync(join(root, p)));
  const derivedFrom = [...new Set(sourcePaths)].sort().map((path) => ({
    path,
    sha256: sha256(readFileSync(join(root, path), 'utf8')),
  }));

  const profile = {
    version: SCHEMA_VERSION,
    generatedAt: now,
    derivedFrom,
    styling,
    components,
    tokens,
    conventions,
  };

  for (const [path, value] of Object.entries(safeOverrides)) setPath(profile, path, value);

  profile.confidence = scoreConfidence(profile);

  // A human answer is authoritative: any group touched by an override scores
  // high, regardless of what the automatic detectors alone would say.
  const resolvedGroups = new Set(Object.keys(safeOverrides).map((path) => path.split('.')[0]));
  for (const group of resolvedGroups) {
    if (group in profile.confidence) profile.confidence[group] = 'high';
  }

  return profile;
}

// Structural validity only — the same shape check-profile.mjs treats as
// "not a usable profile" (exit 3). Deliberately does not check staleness or
// schema-version-newer; callers that only need to know whether a file is
// safe to read fields out of should use this, not re-implement it.
export function isValidProfileShape(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
  if (typeof profile.version !== 'number') return false;
  if (!Array.isArray(profile.derivedFrom)) return false;
  return profile.derivedFrom.every(
    (entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
      && typeof entry.path === 'string' && typeof entry.sha256 === 'string',
  );
}

export function stalePaths(root, profile) {
  return profile.derivedFrom
    .filter(({ path, sha256: recorded }) => {
      const full = join(root, path);
      if (!existsSync(full)) return true;
      return sha256(readFileSync(full, 'utf8')) !== recorded;
    })
    .map(({ path }) => path);
}
