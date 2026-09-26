import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { extractCustomProperties } from './tokens.mjs';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.next', 'coverage']);

export function walkFiles(root, extensions) {
  const out = [];
  const visit = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) visit(join(dir, entry.name));
      } else if (extensions.some((e) => entry.name.endsWith(e))) {
        out.push(relative(root, join(dir, entry.name)).split(sep).join('/'));
      }
    }
  };
  visit(root);
  return out.sort();
}

export function readManifest(root) {
  const path = join(root, 'package.json');
  if (!existsSync(path)) return null;
  try {
    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    return { pkg, deps: { ...pkg.dependencies, ...pkg.devDependencies } };
  } catch {
    return null;
  }
}

// The directory of the nearest package.json at or above a repo-relative
// path, or '' for the repo root. In a monorepo the UI's dependencies live in
// its own package — `web/package.json`, `dashboard/package.json` — and the
// root manifest, when there is one, belongs to the workspace or to a server.
export function owningPackage(root, relPath) {
  let dir = dirname(relPath);
  while (dir && dir !== '.') {
    if (existsSync(join(root, dir, 'package.json'))) return dir;
    dir = dirname(dir);
  }
  return '';
}

const majorOf = (range) => Number(String(range ?? '').replace(/^[^\d]*/, '').split('.')[0]) || null;

export function detectStyling(root, deps) {
  const stylesheets = walkFiles(root, ['.css']);
  const withTokens = stylesheets.filter((f) => Object.keys(extractCustomProperties(readFileSync(join(root, f), 'utf8'))).length >= 3);
  const tokenSource = withTokens;
  const tokenSyntax = tokenSource.length
    ? (readFileSync(join(root, tokenSource[0]), 'utf8').includes('@theme') ? '@theme' : ':root')
    : null;
  const extraStylesheets = stylesheets.filter((f) => !tokenSource.includes(f));

  let system = null;
  let utilityFirst = false;
  if (deps.tailwindcss) {
    system = majorOf(deps.tailwindcss) >= 4 ? 'tailwind-v4' : 'tailwind-v3';
    utilityFirst = true;
  } else if (deps['styled-components']) system = 'styled-components';
  else if (deps['@emotion/react'] || deps['@emotion/styled']) system = 'emotion';
  else if (stylesheets.some((f) => f.includes('.module.css'))) system = 'css-modules';
  else if (stylesheets.length) system = 'plain-css';

  return { system, tokenSource, tokenSyntax, utilityFirst, extraStylesheets };
}

export function detectComponents(root, deps, packageDir = '') {
  const files = walkFiles(root, ['.tsx', '.jsx', '.vue', '.svelte']);
  const counts = new Map();
  for (const file of files) {
    const dir = file.split('/').slice(0, -1).join('/');
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }
  // Prefer /ui within a band of the densest directory.
  const maxCount = counts.size ? Math.max(...counts.values()) : 0;
  const threshold = maxCount * 0.25;
  const inBand = [...counts.entries()].filter(([, count]) => count >= threshold);
  const ranked = inBand.sort((a, b) => {
    const uiA = a[0].endsWith('/ui') ? 1 : 0;
    const uiB = b[0].endsWith('/ui') ? 1 : 0;
    return uiB - uiA || b[1] - a[1] || a[0].localeCompare(b[0]);
  });
  const dir = ranked.length ? ranked[0][0] : null;

  let variantMechanism = 'props';
  if (deps['class-variance-authority']) variantMechanism = 'cva';
  else if (deps['styled-components'] || deps['@emotion/styled']) variantMechanism = 'styled';
  else if (deps.tv || deps['tailwind-variants']) variantMechanism = 'tailwind-variants';

  const library = existsSync(join(root, packageDir, 'components.json')) ? 'shadcn' : null;
  let primitives = null;
  if (deps['radix-ui'] || Object.keys(deps).some((d) => d.startsWith('@radix-ui/'))) primitives = 'radix';
  else if (deps['@headlessui/react']) primitives = 'headless-ui';
  else if (deps['react-aria-components']) primitives = 'react-aria';

  return { dir, library, variantMechanism, primitives };
}

export function detectConventions(deps) {
  let framework = null;
  if (deps.react) framework = `react-${majorOf(deps.react) ?? 'unknown'}`;
  else if (deps.vue) framework = `vue-${majorOf(deps.vue) ?? 'unknown'}`;
  else if (deps.svelte) framework = `svelte-${majorOf(deps.svelte) ?? 'unknown'}`;

  let router = null;
  if (deps['@tanstack/react-router']) router = 'tanstack-router';
  else if (deps['react-router-dom']) router = 'react-router';
  else if (deps.next) router = 'next';

  let testRunner = null;
  if (deps.vitest) testRunner = 'vitest';
  else if (deps.jest) testRunner = 'jest';

  let iconSet = null;
  if (deps['lucide-react']) iconSet = 'lucide';
  else if (Object.keys(deps).some((d) => d.startsWith('@heroicons/'))) iconSet = 'heroicons';
  else if (deps['react-icons']) iconSet = 'react-icons';

  return { framework, router, testRunner, iconSet, a11yTarget: 'WCAG 2.2 AA' };
}
