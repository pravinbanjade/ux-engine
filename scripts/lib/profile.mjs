import { createHash } from 'node:crypto';
import { readFileSync, existsSync, realpathSync, statSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, sep } from 'node:path';
import { extractCustomProperties, groupTokens, themedTokenNames, TOKEN_KINDS } from './tokens.mjs';
import { readManifest, detectStyling, detectComponents, detectConventions, owningPackage } from './detect.mjs';

export const SCHEMA_VERSION = 1;

// True when `candidate` (an absolute path) resolves to `root` itself or
// somewhere underneath it. A plain `candidate.startsWith(root)` is not
// enough — it would let "/repo-evil" pass a check against root "/repo" —
// and a plain string check on the *unresolved* path is defeated outright by
// a "../" segment, which is exactly the shape a hostile tokenSource entry
// takes. Comparing resolved paths via `relative` closes both gaps.
function isWithinRoot(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
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
  // Where the UI lives decides whose dependencies describe it. The component
  // directory and the token files are found without reading any manifest, so
  // find them first, then read the package that owns them. Reading only the
  // root manifest made every monorepo look dependency-free: a Tailwind v4
  // frontend under `web/` was recorded as plain CSS with no framework, router,
  // test runner, primitives or variant mechanism, and a root that is itself a
  // server contributed its own dependencies instead.
  const rootDeps = readManifest(root)?.deps ?? {};
  const probeStyling = detectStyling(root, rootDeps);
  const probeComponents = detectComponents(root, rootDeps);
  const anchor = probeComponents.dir ? `${probeComponents.dir}/x` : probeStyling.tokenSource[0];
  const packageDir = anchor ? owningPackage(root, anchor) : '';
  const deps = packageDir ? { ...rootDeps, ...(readManifest(join(root, packageDir))?.deps ?? {}) } : rootDeps;

  const styling = detectStyling(root, deps);
  const components = detectComponents(root, deps, packageDir);
  // '' when the UI is the repository itself. The scanner stays inside this
  // package by default: a server's email templates and a CLI's colours are
  // not the UI, and reporting them as UX findings buries the ones that are.
  components.package = packageDir;
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
  // depends on for staleness checks, not just the recorded field. But a
  // committed profile.json is a pull-request-editable artifact, and
  // styling.tokenSource is on RESOLVABLE_FIELDS precisely so a human can
  // correct it — so a hostile or careless entry (an absolute path, a
  // "../secret.css" escape) must never be read, hashed, or carried into the
  // profile. Every entry is resolved against `root` and dropped — with a
  // warning naming it — if it resolves outside the repository, or if it
  // simply does not exist (a bad hand edit, not an attack, but an ENOENT
  // that used to crash this loop outright).
  const resolvedRoot = resolve(root);
  let realRoot;
  try {
    realRoot = realpathSync(resolvedRoot);
  } catch {
    realRoot = resolvedRoot;
  }
  const tokenSourceCandidates = safeOverrides['styling.tokenSource'] ?? styling.tokenSource;
  const tokenSource = [];
  let props = {};
  const tokenCss = [];
  for (const file of tokenSourceCandidates) {
    const full = resolve(join(root, file));
    let realFull;
    try {
      realFull = realpathSync(full);
    } catch {
      // Broken symlink or missing file
      console.warn(`ux-engine: skipping styling.tokenSource entry that does not exist: ${file}`);
      continue;
    }
    if (!isWithinRoot(realRoot, realFull)) {
      console.warn(`ux-engine: refusing styling.tokenSource entry outside the repository root: ${file}`);
      continue;
    }
    try {
      const stat = statSync(realFull);
      if (!stat.isFile()) {
        console.warn(`ux-engine: skipping styling.tokenSource entry that is not a regular file: ${file}`);
        continue;
      }
    } catch {
      console.warn(`ux-engine: skipping styling.tokenSource entry that does not exist: ${file}`);
      continue;
    }
    tokenSource.push(file);
    const css = readFileSync(realFull, 'utf8');
    tokenCss.push(css);
    props = { ...props, ...extractCustomProperties(css) };
  }
  const tokens = groupTokens(props);
  // Recorded beside the source list, not inside `tokens`: it is a fact about
  // how the token files declare them, and /ux-restyle is the one reader.
  styling.themedTokens = themedTokenNames(tokenCss);

  // If a human override named styling.tokenSource, what ends up recorded on
  // the profile must be the same sanitized list used above — an escaping or
  // missing entry must not survive into the committed profile just because
  // resolvedByHuman named it.
  if ('styling.tokenSource' in safeOverrides) safeOverrides['styling.tokenSource'] = tokenSource;

  const uiManifests = packageDir ? [`${packageDir}/package.json`, `${packageDir}/components.json`] : [];
  const sourcePaths = ['package.json', 'components.json', ...uiManifests, ...tokenSource].filter((p) => existsSync(join(root, p)));
  const derivedFrom = [...new Set(sourcePaths)].sort().map((path) => ({
    path,
    sha256: sha256(readFileSync(join(root, path))),
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

// The narrow structural check detect-profile.mjs's readExistingProfile uses
// to decide whether an on-disk profile is trustworthy enough to read
// `resolvedByHuman` answers out of. Deliberately narrower than
// validateProfile below: a profile a human is mid-way through hand-editing
// (or one crafted to smuggle a resolvedByHuman entry) may legitimately lack
// `styling`/`components`/`tokens`/`conventions` while still needing its
// `resolvedByHuman` array checked field-by-field against RESOLVABLE_FIELDS
// — that check happens regardless of what this function returns, so this
// only guards the two fields the override machinery itself depends on
// (derivedFrom's shape, and version for the schema check).
export function isValidProfileShape(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
  if (typeof profile.version !== 'number') return false;
  if (!Array.isArray(profile.derivedFrom)) return false;
  return profile.derivedFrom.every(
    (entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
      && typeof entry.path === 'string' && typeof entry.sha256 === 'string',
  );
}

// The single shape gate for the three CLIs that treat .ux-engine/profile.json
// as an input to read fields out of — check-profile.mjs, write-design-doc.mjs
// and scan-off-system.mjs. Returns null when the profile is complete enough
// for all three to safely use, or a specific, human-readable defect message
// otherwise. Each CLI owns its own exit code and remediation text; none of
// them re-implements what "a usable profile" means.
//
// This is stricter than isValidProfileShape on purpose: `{"version":1,
// "derivedFrom":[]}` passes isValidProfileShape's narrower check (which is
// all detect-profile.mjs's override bookkeeping needs) but is missing every
// field write-design-doc.mjs and scan-off-system.mjs actually read, and
// those CLIs must fail cleanly on it rather than throw.
export function validateProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return 'Profile is not a JSON object.';
  }
  if (typeof profile.version !== 'number') {
    return 'Profile is missing or has an invalid "version" field.';
  }
  if (!Array.isArray(profile.derivedFrom)) {
    return 'Profile is missing or has an invalid "derivedFrom" field.';
  }
  for (const entry of profile.derivedFrom) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return 'Profile "derivedFrom" entry is not a JSON object.';
    }
    if (typeof entry.path !== 'string') {
      return 'Profile "derivedFrom" entry missing or has invalid "path" field.';
    }
    if (typeof entry.sha256 !== 'string') {
      return 'Profile "derivedFrom" entry missing or has invalid "sha256" field.';
    }
  }
  if (!profile.styling || typeof profile.styling !== 'object' || Array.isArray(profile.styling)
    || !isStringArray(profile.styling.tokenSource)) {
    return 'Profile is missing or has an invalid "styling" field.';
  }
  if (!profile.components || typeof profile.components !== 'object' || Array.isArray(profile.components)) {
    return 'Profile is missing or has an invalid "components" field.';
  }
  if (!profile.tokens || typeof profile.tokens !== 'object' || Array.isArray(profile.tokens)) {
    return 'Profile is missing or has an invalid "tokens" field.';
  }
  if (!profile.conventions || typeof profile.conventions !== 'object' || Array.isArray(profile.conventions)) {
    return 'Profile is missing or has an invalid "conventions" field.';
  }
  return null;
}

// derivedFrom is not on RESOLVABLE_FIELDS and detect-profile.mjs refuses any
// resolvedByHuman entry naming it, but a committed profile.json is still a
// pull-request-editable file: nothing stops someone hand-crafting a
// derivedFrom entry whose path escapes the repository. Reading such a path
// to hash it would be the same fingerprinting oracle Critical 1 closes in
// buildProfile, so an escaping entry is reported as stale outright — never
// read — exactly like a deleted source file already is below.
export function stalePaths(root, profile) {
  const resolvedRoot = resolve(root);
  let realRoot;
  try {
    realRoot = realpathSync(resolvedRoot);
  } catch {
    realRoot = resolvedRoot;
  }
  return profile.derivedFrom
    .filter(({ path, sha256: recorded }) => {
      const full = resolve(join(root, path));
      let realFull;
      try {
        realFull = realpathSync(full);
      } catch {
        // Broken symlink or missing file
        return true;
      }
      if (!isWithinRoot(realRoot, realFull)) return true;
      try {
        const stat = statSync(realFull);
        if (!stat.isFile()) return true;
      } catch {
        return true;
      }
      return sha256(readFileSync(realFull)) !== recorded;
    })
    .map(({ path }) => path);
}
