import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The wireframe artifact: every rule about its *shape*. Rules about whether an
// answer is thoughtful or a hierarchy is right belong to skills/design-ui, not
// here — a validator that graded judgment would be inventing policy.

export const WIREFRAME_VERSION = 1;

export const INTENT_KEYS = ['who', 'cadence', 'primaryAction', 'failure', 'scale'];

// Deliberately shallow. Its job is to catch the answer that was never given,
// not to grade the one that was.
const MIN_ANSWER_LENGTH = 12;
const NON_ANSWERS = new Set(['n/a', 'na', 'tbd', 'todo', 'unknown', 'none', '?', '-']);

export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

export function validateIntent(intent, prefix = 'intent') {
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) {
    return [`${prefix}: must be an object`];
  }
  const errors = [];
  for (const key of INTENT_KEYS) {
    const raw = intent[key];
    if (typeof raw !== 'string' || !raw.trim()) {
      errors.push(`${prefix}.${key}: not answered`);
      continue;
    }
    const answer = raw.trim();
    if (NON_ANSWERS.has(answer.toLowerCase())) {
      errors.push(`${prefix}.${key}: "${answer}" is a placeholder, not an answer`);
      continue;
    }
    if (answer.length < MIN_ANSWER_LENGTH) {
      errors.push(`${prefix}.${key}: "${answer}" is too short to be an answer`);
    }
  }
  return errors;
}

export const STATE_KEYS = ['empty', 'loading', 'error', 'populated'];

const MAX_LAYOUT_DEPTH = 6;
const REVISION_KINDS = new Set(['edit', 'redispatch']);

function layoutErrors(nodes, path, depth, errors) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    errors.push(`${path}: must be a non-empty array of regions`);
    return;
  }
  if (depth > MAX_LAYOUT_DEPTH) {
    errors.push(`${path}: nested deeper than ${MAX_LAYOUT_DEPTH} levels`);
    return;
  }
  for (const [i, node] of nodes.entries()) {
    const at = `${path}[${i}]`;
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      errors.push(`${at}: must be an object`);
      continue;
    }
    if (typeof node.region !== 'string' || !node.region.trim()) {
      errors.push(`${at}: region must be a non-empty string`);
    }
    // A present `children` must hold something. `{region}` and
    // `{region, children: []}` mean the same thing, and two spellings of one
    // concept give the renderer and the diff two shapes to handle for nothing.
    if (node.children !== undefined) layoutErrors(node.children, `${at}.children`, depth + 1, errors);
  }
}

function hierarchyErrors(hierarchy, errors) {
  if (!Array.isArray(hierarchy) || hierarchy.length === 0) {
    errors.push('hierarchy: must be a non-empty array');
    return;
  }
  const ranks = [];
  for (const [i, entry] of hierarchy.entries()) {
    const at = `hierarchy[${i}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${at}: must be an object`);
      continue;
    }
    if (typeof entry.element !== 'string' || !entry.element.trim()) {
      errors.push(`${at}.element: must be a non-empty string`);
    }
    if (!Number.isInteger(entry.rank)) {
      errors.push(`${at}.rank: must be an integer`);
      continue;
    }
    ranks.push(entry.rank);
  }
  // Only worth stating the total-order rule once every rank is a number.
  if (ranks.length !== hierarchy.length) return;
  const expected = hierarchy.map((_, i) => i + 1).join(',');
  if ([...ranks].sort((a, b) => a - b).join(',') !== expected) {
    // UX-031 asks which element is the entry point. A wireframe with two
    // rank-1 elements has not answered it; one with a gap lost an element
    // between stages. Requiring exactly 1..n makes both unrepresentable.
    errors.push(`hierarchy: ranks must be exactly 1..${hierarchy.length} with no repeats, got ${ranks.join(', ')}`);
  }
}

function stateErrors(states, errors) {
  if (!states || typeof states !== 'object' || Array.isArray(states)) {
    errors.push('states: must be an object with empty, loading, error and populated');
    return;
  }
  for (const key of STATE_KEYS) {
    const value = states[key];
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`states.${key}: must describe what the user sees`);
    }
  }
}

function revisionErrors(revisions, errors) {
  if (revisions === undefined) return;
  if (!Array.isArray(revisions)) {
    errors.push('revisions: must be an array when present');
    return;
  }
  for (const [i, r] of revisions.entries()) {
    const at = `revisions[${i}]`;
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      errors.push(`${at}: must be an object`);
      continue;
    }
    if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) {
      errors.push(`${at}.at: must be an ISO 8601 timestamp`);
    }
    if (!REVISION_KINDS.has(r.kind)) errors.push(`${at}.kind: must be "edit" or "redispatch"`);
    if (typeof r.note !== 'string' || !r.note.trim()) {
      errors.push(`${at}.note: must say what the reviewer asked for`);
    }
  }
}

// How a codebase actually writes an import path. Found by the design dogfood:
// a real repository imports every reused component as `@/components/ui/card`
// — a module alias, no extension — so a literal existsSync reported every one
// of them missing. Resolving the path is part of implementing the rule
// honestly, not a new rule on top of it.
const SOURCE_SUFFIXES = [
  '', '.tsx', '.ts', '.jsx', '.js',
  '/index.tsx', '/index.ts', '/index.jsx', '/index.js',
];

const isFile = (path) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

// tsconfig's `compilerOptions.paths` is where a project declares its aliases,
// so nothing here is guessed. Only the ordinary `prefix/*` -> `target/*` shape
// is handled; anything else, or an unreadable tsconfig, simply yields no
// aliases and the path is tried as written.
function aliasMap(root) {
  let config;
  try {
    config = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8'));
  } catch {
    return [];
  }
  const paths = config?.compilerOptions?.paths;
  if (!paths || typeof paths !== 'object') return [];
  return Object.entries(paths).flatMap(([from, targets]) => {
    if (!from.endsWith('/*') || !Array.isArray(targets)) return [];
    const prefix = from.slice(0, -1);
    return targets
      .filter((t) => typeof t === 'string' && t.endsWith('/*'))
      .map((t) => ({ prefix, target: t.slice(0, -1).replace(/^\.\//, '') }));
  });
}

function componentExists(root, source, aliases) {
  const candidates = [source];
  for (const { prefix, target } of aliases) {
    if (source.startsWith(prefix)) candidates.push(target + source.slice(prefix.length));
  }
  return candidates.some((c) => SOURCE_SUFFIXES.some((suffix) => isFile(join(root, c + suffix))));
}

// `profile` is unused today: the rule that a reused component must live under
// profile.components.dir was considered and dropped, because reusing a
// feature-level component outside the primitives directory is legitimate and
// an error there would push the wireframer to mark real components as new.
// The parameter stays because it is part of the published signature.
function componentErrors(components, profile, root, errors) {
  if (!Array.isArray(components) || components.length === 0) {
    errors.push('components: must be a non-empty array');
    return;
  }
  const seen = new Set();
  const aliases = root ? aliasMap(root) : [];
  for (const [i, c] of components.entries()) {
    const at = `components[${i}]`;
    if (!c || typeof c !== 'object' || Array.isArray(c)) {
      errors.push(`${at}: must be an object`);
      continue;
    }
    if (typeof c.name !== 'string' || !c.name.trim()) {
      errors.push(`${at}.name: must be a non-empty string`);
    } else if (seen.has(c.name)) {
      errors.push(`${at}.name: "${c.name}" appears more than once`);
    } else {
      seen.add(c.name);
    }
    if (typeof c.source !== 'string' || !c.source.trim()) {
      errors.push(`${at}.source: must be a non-empty string`);
      continue;
    }
    if (typeof c.existing !== 'boolean') {
      errors.push(`${at}.existing: must be true or false`);
      continue;
    }
    if (c.existing && root && !componentExists(root, c.source, aliases)) {
      errors.push(`${at}.source: "${c.source}" is marked existing but no file is there`);
    }
  }
}

export function validateWireframe(wf, profile, { root } = {}) {
  if (!wf || typeof wf !== 'object' || Array.isArray(wf)) return ['wireframe must be an object'];
  const errors = [];
  if (wf.version !== WIREFRAME_VERSION) {
    errors.push(`version: must be ${WIREFRAME_VERSION}, got ${JSON.stringify(wf.version)}`);
  }
  if (typeof wf.slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(wf.slug)) {
    errors.push('slug: must be lowercase letters, digits and hyphens, starting with a letter or digit');
  }
  errors.push(...validateIntent(wf.intent));
  layoutErrors(wf.layout, 'layout', 1, errors);
  componentErrors(wf.components, profile, root, errors);
  hierarchyErrors(wf.hierarchy, errors);
  stateErrors(wf.states, errors);
  revisionErrors(wf.revisions, errors);
  return errors;
}

const INTENT_LABELS = {
  who: 'Who uses this',
  cadence: 'How often',
  primaryAction: 'Primary action',
  failure: 'When it fails',
  scale: 'At realistic scale',
};

const STATE_LABELS = {
  empty: 'Empty',
  loading: 'Loading',
  error: 'Error',
  populated: 'Populated at scale',
};

const renderLayout = (nodes, depth, out) => {
  for (const node of nodes ?? []) {
    out.push(`${'  '.repeat(depth)}- ${node.region}`);
    if (node.children) renderLayout(node.children, depth + 1, out);
  }
};

const renderInventory = (label, list, out) => {
  out.push(`${label}:`);
  if (!list.length) out.push('- _none_');
  else for (const c of list) out.push(`- \`${c.name}\` — ${c.source}`);
};

export function renderWireframe(wf) {
  const out = [`# ${wf.slug}`, '', '## Intent', '', '| Question | Answer |', '| --- | --- |'];
  for (const key of INTENT_KEYS) out.push(`| ${INTENT_LABELS[key]} | ${wf.intent?.[key] ?? ''} |`);

  out.push('', '## Layout', '');
  renderLayout(wf.layout, 0, out);

  out.push('', '## Components', '');
  const components = wf.components ?? [];
  renderInventory('Reused', components.filter((c) => c.existing), out);
  out.push('');
  renderInventory('New', components.filter((c) => !c.existing), out);

  out.push('', '## Hierarchy', '');
  for (const e of [...(wf.hierarchy ?? [])].sort((a, b) => a.rank - b.rank)) {
    out.push(`${e.rank}. ${e.element}`);
  }

  out.push('', '## States', '');
  for (const key of STATE_KEYS) out.push(`**${STATE_LABELS[key]}** — ${wf.states?.[key] ?? ''}`, '');

  if (wf.revisions?.length) {
    out.push('## Revisions', '');
    for (const r of wf.revisions) out.push(`- ${r.at} (${r.kind}) — ${r.note}`);
  }

  return `${out.join('\n').trimEnd()}\n`;
}

// Flatten to leaf values keyed by a dotted path, so a diff names the smallest
// thing that actually changed rather than "states differ".
const leaves = (value, path, out) => {
  if (Array.isArray(value)) {
    value.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value).sort()) {
      leaves(value[key], path ? `${path}.${key}` : key, out);
    }
  } else {
    out.set(path, value);
  }
};

const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export function diffWireframes(prev, next) {
  const before = new Map();
  const after = new Map();
  leaves(prev ?? {}, '', before);
  leaves(next ?? {}, '', after);

  const added = [];
  const changed = [];
  const removed = [];
  for (const [path, value] of after) {
    if (!before.has(path)) added.push({ path, after: value });
    else if (before.get(path) !== value) changed.push({ path, before: before.get(path), after: value });
  }
  for (const [path, value] of before) {
    if (!after.has(path)) removed.push({ path, before: value });
  }
  return { added: added.sort(byPath), removed: removed.sort(byPath), changed: changed.sort(byPath) };
}

// Every correction this repository's reviewer has made, newest first. Stage 2
// hands these to the wireframer so a draft that keeps getting the same thing
// wrong gets it wrong once rather than once per run.
export function collectRevisionNotes(dir, { limit = 20, exclude } = {}) {
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const rows = [];
  for (const file of files) {
    let wf;
    try {
      wf = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch {
      // One broken artifact from an interrupted run must not block a new one.
      continue;
    }
    if (!wf || typeof wf !== 'object' || !Array.isArray(wf.revisions)) continue;
    if (exclude !== undefined && wf.slug === exclude) continue;
    for (const r of wf.revisions) {
      if (!r || typeof r.note !== 'string' || !r.note.trim()) continue;
      rows.push({ at: typeof r.at === 'string' ? r.at : '', note: r.note.trim() });
    }
  }
  rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return rows.slice(0, limit).map((r) => r.note);
}
