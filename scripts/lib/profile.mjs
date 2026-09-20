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

// Sets a dotted path ("components.variantMechanism") on an object, creating
// intermediate objects as needed.
function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (typeof cur[key] !== 'object' || cur[key] === null) cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
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

  // A human-corrected token source takes effect immediately: it changes
  // which files get scanned for tokens and which files this profile
  // depends on for staleness checks, not just the recorded field.
  const tokenSource = overrides['styling.tokenSource'] ?? styling.tokenSource;

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

  for (const [path, value] of Object.entries(overrides)) setPath(profile, path, value);

  profile.confidence = scoreConfidence(profile);

  // A human answer is authoritative: any group touched by an override scores
  // high, regardless of what the automatic detectors alone would say.
  const resolvedGroups = new Set(Object.keys(overrides).map((path) => path.split('.')[0]));
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
