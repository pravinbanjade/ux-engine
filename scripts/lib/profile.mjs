import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { extractCustomProperties, groupTokens, TOKEN_KINDS } from './tokens.mjs';
import { readManifest, detectStyling, detectComponents, detectConventions, walkFiles } from './detect.mjs';

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

export function buildProfile(root, { now = new Date().toISOString() } = {}) {
  const manifest = readManifest(root);
  const deps = manifest?.deps ?? {};

  const styling = detectStyling(root, deps);
  const components = detectComponents(root, deps);
  const conventions = detectConventions(deps);

  let props = {};
  for (const file of styling.tokenSource) {
    props = { ...props, ...extractCustomProperties(readFileSync(join(root, file), 'utf8')) };
  }
  const tokens = groupTokens(props);

  const sourcePaths = ['package.json', 'components.json', ...styling.tokenSource].filter((p) => existsSync(join(root, p)));
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
  profile.confidence = scoreConfidence(profile);
  return profile;
}

export function isStale(root, profile) {
  return profile.derivedFrom
    .filter(({ path, sha256: recorded }) => {
      const full = join(root, path);
      if (!existsSync(full)) return true;
      return sha256(readFileSync(full, 'utf8')) !== recorded;
    })
    .map(({ path }) => path);
}
