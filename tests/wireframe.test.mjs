import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { slugify, validateIntent, validateWireframe, renderWireframe, diffWireframes, collectRevisionNotes, INTENT_KEYS, STATE_KEYS, WIREFRAME_VERSION } from '../scripts/lib/wireframe.mjs';

const GOOD_INTENT = {
  who: 'Risk analysts who already know the portfolio names',
  cadence: 'Several times an hour during the morning close',
  primaryAction: 'Run a fresh report against the selected portfolio',
  failure: 'The run times out and the analyst has to explain the gap',
  scale: 'Four hundred rows on a bad day, twelve on a normal one',
};

test('slugify lowercases and hyphenates', () => {
  assert.equal(slugify('Risk Report List'), 'risk-report-list');
});

test('slugify collapses runs of punctuation and trims the edges', () => {
  assert.equal(slugify('  --Risk / Report:: list!! '), 'risk-report-list');
});

test('slugify truncates to 60 characters without leaving a trailing hyphen', () => {
  const slug = slugify(`${'a'.repeat(59)} b`);
  assert.ok(slug.length <= 60);
  assert.ok(!slug.endsWith('-'), `trailing hyphen in "${slug}"`);
});

test('slugify returns an empty string when nothing survives', () => {
  assert.equal(slugify('///'), '');
  assert.equal(slugify(''), '');
  assert.equal(slugify(undefined), '');
});

test('a complete intent produces no errors', () => {
  assert.deepEqual(validateIntent(GOOD_INTENT), []);
});

test('every missing key is named', () => {
  const errors = validateIntent({});
  assert.equal(errors.length, INTENT_KEYS.length);
  for (const key of INTENT_KEYS) {
    assert.ok(errors.some((e) => e.startsWith(`intent.${key}:`)), `no error for ${key}`);
  }
});

test('a placeholder answer is rejected as a placeholder, not as a short answer', () => {
  const errors = validateIntent({ ...GOOD_INTENT, cadence: 'TBD' });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^intent\.cadence: /);
  assert.match(errors[0], /placeholder/);
});

test('every non-answer spelling is caught, case-insensitively', () => {
  for (const value of ['n/a', 'N/A', 'na', 'tbd', 'TODO', 'unknown', 'none', '?', '-']) {
    const errors = validateIntent({ ...GOOD_INTENT, who: value });
    assert.equal(errors.length, 1, `"${value}" was accepted`);
    assert.match(errors[0], /placeholder/, `"${value}" was not read as a placeholder`);
  }
});

test('an answer shorter than twelve characters is rejected', () => {
  const errors = validateIntent({ ...GOOD_INTENT, who: 'Analysts' });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /too short/);
});

test('a twelve-character answer is accepted — the floor proves a field was filled in, nothing more', () => {
  assert.deepEqual(validateIntent({ ...GOOD_INTENT, who: 'Risk analyst' }), []);
});

test('a non-string answer is not answered', () => {
  const errors = validateIntent({ ...GOOD_INTENT, scale: 400 });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /not answered/);
});

test('the prefix is configurable so the caller controls the error namespace', () => {
  assert.deepEqual(validateIntent({}, 'draft.intent').map((e) => e.split(':')[0]).sort(), [
    'draft.intent.cadence', 'draft.intent.failure', 'draft.intent.primaryAction',
    'draft.intent.scale', 'draft.intent.who',
  ]);
});

test('a non-object intent is one error, not five', () => {
  assert.deepEqual(validateIntent(null), ['intent: must be an object']);
  assert.deepEqual(validateIntent([]), ['intent: must be an object']);
});

test('the wireframe schema version is 1', () => {
  assert.equal(WIREFRAME_VERSION, 1);
});

const GOOD_WIREFRAME = () => ({
  version: 1,
  slug: 'risk-report-list',
  intent: { ...GOOD_INTENT },
  layout: [
    { region: 'header', children: [{ region: 'title' }, { region: 'run report button' }] },
    { region: 'report table' },
  ],
  components: [
    { name: 'DataTable', source: 'src/components/ui/data-table.tsx', existing: true },
    { name: 'RiskReportRow', source: 'src/components/risk-report-row.tsx', existing: false },
  ],
  hierarchy: [
    { rank: 1, element: 'Run report button' },
    { rank: 2, element: 'Report table' },
  ],
  states: {
    empty: 'No reports yet, with a button that runs the first one',
    loading: 'Skeleton rows at the last known row count so the layout does not jump',
    error: 'The run failed, why, and a retry that keeps the selected portfolio',
    populated: 'Four hundred rows, paginated at fifty, with the newest first',
  },
});

// No opts.root, so the component-existence check does not run.
const check = (mutate) => {
  const wf = GOOD_WIREFRAME();
  mutate?.(wf);
  return validateWireframe(wf, { components: { dir: 'src/components/ui' } });
};

test('the golden wireframe is valid', () => {
  assert.deepEqual(check(), []);
});

test('a non-object wireframe is one error', () => {
  assert.deepEqual(validateWireframe(null, {}), ['wireframe must be an object']);
});

test('the version must be exactly 1', () => {
  assert.match(check((wf) => { wf.version = 2; })[0], /^version: /);
  assert.match(check((wf) => { delete wf.version; })[0], /^version: /);
});

test('the slug must be a lowercase kebab string', () => {
  for (const slug of ['Risk-Report', 'risk report', '-risk', 'risk_report', '']) {
    const errors = check((wf) => { wf.slug = slug; });
    assert.ok(errors.some((e) => e.startsWith('slug:')), `"${slug}" was accepted`);
  }
});

test('intent errors are reported under the intent namespace', () => {
  const errors = check((wf) => { wf.intent.who = ''; });
  assert.deepEqual(errors, ['intent.who: not answered']);
});

test('the layout must be a non-empty array of regions', () => {
  assert.match(check((wf) => { wf.layout = []; })[0], /^layout: /);
  assert.match(check((wf) => { wf.layout = 'header'; })[0], /^layout: /);
});

test('a region must be a non-empty string', () => {
  const errors = check((wf) => { wf.layout[0].region = '   '; });
  assert.deepEqual(errors, ['layout[0]: region must be a non-empty string']);
});

test('a nested region is checked too, and named by its path', () => {
  const errors = check((wf) => { delete wf.layout[0].children[1].region; });
  assert.deepEqual(errors, ['layout[0].children[1]: region must be a non-empty string']);
});

test('an empty children array is an error — a leaf is written without the key', () => {
  const errors = check((wf) => { wf.layout[1].children = []; });
  assert.deepEqual(errors, ['layout[1].children: must be a non-empty array of regions']);
});

test('layout nesting deeper than six levels is rejected', () => {
  const errors = check((wf) => {
    let node = { region: 'l1' };
    wf.layout = [node];
    for (let i = 2; i <= 8; i += 1) {
      const child = { region: `l${i}` };
      node.children = [child];
      node = child;
    }
  });
  assert.ok(errors.some((e) => /deeper than 6/.test(e)), errors.join('\n'));
});

test('the hierarchy must be a non-empty array', () => {
  assert.match(check((wf) => { wf.hierarchy = []; })[0], /^hierarchy: /);
});

test('two elements cannot share rank 1 — that is the question UX-031 asks', () => {
  const errors = check((wf) => { wf.hierarchy[1].rank = 1; });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /ranks must be exactly 1\.\.2 with no repeats/);
});

test('a gap in the ranks means an element was lost between stages', () => {
  const errors = check((wf) => { wf.hierarchy[1].rank = 3; });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /ranks must be exactly 1\.\.2/);
});

test('a hierarchy element must be a non-empty string', () => {
  const errors = check((wf) => { wf.hierarchy[0].element = ''; });
  assert.deepEqual(errors, ['hierarchy[0].element: must be a non-empty string']);
});

test('a non-integer rank is reported before the total-order rule runs', () => {
  const errors = check((wf) => { wf.hierarchy[0].rank = '1'; });
  assert.deepEqual(errors, ['hierarchy[0].rank: must be an integer']);
});

test('all four states are required', () => {
  for (const key of STATE_KEYS) {
    const errors = check((wf) => { delete wf.states[key]; });
    assert.deepEqual(errors, [`states.${key}: must describe what the user sees`]);
  }
});

test('a blank state is the same as a missing one', () => {
  assert.deepEqual(check((wf) => { wf.states.error = '  '; }), ['states.error: must describe what the user sees']);
});

test('revisions are optional', () => {
  assert.deepEqual(check((wf) => { delete wf.revisions; }), []);
});

test('a well-formed revision is accepted', () => {
  assert.deepEqual(check((wf) => {
    wf.revisions = [{ at: '2026-09-22T10:31:00.000Z', kind: 'redispatch', note: 'Hierarchy was inverted.' }];
  }), []);
});

test('a revision must carry a parseable timestamp, a known kind and a note', () => {
  const errors = check((wf) => { wf.revisions = [{ at: 'yesterday', kind: 'rewrite', note: '  ' }]; });
  assert.deepEqual(errors.sort(), [
    'revisions[0].at: must be an ISO 8601 timestamp',
    'revisions[0].kind: must be "edit" or "redispatch"',
    'revisions[0].note: must say what the reviewer asked for',
  ]);
});

test('revisions present but not an array is one error', () => {
  assert.deepEqual(check((wf) => { wf.revisions = {}; }), ['revisions: must be an array when present']);
});

// A throwaway repo holding exactly the one component the golden wireframe
// claims to reuse.
const withRepo = (body) => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-wireframe-'));
  try {
    mkdirSync(join(root, 'src/components/ui'), { recursive: true });
    writeFileSync(join(root, 'src/components/ui/data-table.tsx'), 'export const DataTable = () => null;\n');
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const PROFILE = { components: { dir: 'src/components/ui' } };

test('the component inventory must be a non-empty array', () => {
  assert.match(check((wf) => { wf.components = []; })[0], /^components: /);
  assert.match(check((wf) => { wf.components = 'DataTable'; })[0], /^components: /);
});

test('every entry needs a name, a source and a boolean existing', () => {
  assert.deepEqual(check((wf) => { wf.components[0].name = ''; }), ['components[0].name: must be a non-empty string']);
  assert.deepEqual(check((wf) => { delete wf.components[0].source; }), ['components[0].source: must be a non-empty string']);
  assert.deepEqual(check((wf) => { wf.components[0].existing = 'yes'; }), ['components[0].existing: must be true or false']);
});

test('two entries cannot share a name', () => {
  const errors = check((wf) => { wf.components[1].name = 'DataTable'; });
  assert.deepEqual(errors, ['components[1].name: "DataTable" appears more than once']);
});

test('a component marked existing must be on disk when a root is given', () => {
  withRepo((root) => {
    const wf = GOOD_WIREFRAME();
    assert.deepEqual(validateWireframe(wf, PROFILE, { root }), []);

    wf.components[0].source = 'src/components/ui/nope.tsx';
    assert.deepEqual(validateWireframe(wf, PROFILE, { root }), [
      'components[0].source: "src/components/ui/nope.tsx" is marked existing but no file is there',
    ]);
  });
});

test('a component marked new is not looked for on disk', () => {
  withRepo((root) => {
    const wf = GOOD_WIREFRAME();
    // components[1] is existing:false and its file does not exist.
    assert.deepEqual(validateWireframe(wf, PROFILE, { root }), []);
  });
});

test('without a root the existence check is skipped, so the rules stay testable off-disk', () => {
  const wf = GOOD_WIREFRAME();
  wf.components[0].source = 'src/components/ui/nope.tsx';
  assert.deepEqual(validateWireframe(wf, PROFILE), []);
});

test('a reused component outside the primitives directory is accepted', () => {
  // Reusing a feature-level component is legitimate. An error here would push
  // the wireframer to mark real components as new, which is the opposite of
  // what the inventory is for.
  withRepo((root) => {
    mkdirSync(join(root, 'src/features/report'), { recursive: true });
    writeFileSync(join(root, 'src/features/report/row.tsx'), 'export const Row = () => null;\n');
    const wf = GOOD_WIREFRAME();
    wf.components.push({ name: 'ReportRow', source: 'src/features/report/row.tsx', existing: true });
    assert.deepEqual(validateWireframe(wf, PROFILE, { root }), []);
  });
});

const golden = () => JSON.parse(readFileSync(new URL('./fixtures/wireframes/risk-report-list.json', import.meta.url), 'utf8'));

test('the golden fixture is a valid wireframe', () => {
  assert.deepEqual(validateWireframe(golden(), PROFILE), []);
});

test('the rendered wireframe matches its snapshot', () => {
  const expected = readFileSync(new URL('./snapshots/wireframe-risk-report-list.md', import.meta.url), 'utf8');
  assert.equal(renderWireframe(golden()), expected);
});

test('the render ends in exactly one newline', () => {
  const out = renderWireframe(golden());
  assert.ok(out.endsWith('\n'));
  assert.ok(!out.endsWith('\n\n'));
});

test('the hierarchy renders in rank order regardless of array order', () => {
  const wf = golden();
  wf.hierarchy.reverse();
  const out = renderWireframe(wf);
  assert.ok(out.indexOf('1. Run report button') < out.indexOf('2. Report table'));
});

test('a wireframe with no revisions has no Revisions section', () => {
  const wf = golden();
  delete wf.revisions;
  assert.ok(!renderWireframe(wf).includes('## Revisions'));
});

test('a wireframe that reuses nothing still renders both inventory lists', () => {
  const wf = golden();
  wf.components = wf.components.filter((c) => !c.existing);
  const out = renderWireframe(wf);
  assert.match(out, /Reused:\n- _none_/);
});

test('an identical wireframe diffs to nothing', () => {
  const { added, removed, changed } = diffWireframes(golden(), golden());
  assert.deepEqual({ added, removed, changed }, { added: [], removed: [], changed: [] });
});

test('a changed leaf is reported by its dotted path with both values', () => {
  const next = golden();
  next.states.empty = 'Nothing here yet';
  const { added, removed, changed } = diffWireframes(golden(), next);
  assert.deepEqual(added, []);
  assert.deepEqual(removed, []);
  assert.equal(changed.length, 1);
  assert.equal(changed[0].path, 'states.empty');
  assert.equal(changed[0].after, 'Nothing here yet');
  assert.match(changed[0].before, /^No reports yet/);
});

test('an array element is addressed by index', () => {
  const next = golden();
  next.hierarchy[1].element = 'Results table';
  const { changed } = diffWireframes(golden(), next);
  assert.deepEqual(changed.map((c) => c.path), ['hierarchy[1].element']);
});

test('a new leaf is added and a dropped one is removed', () => {
  const next = golden();
  next.components.pop();
  const { added, removed } = diffWireframes(golden(), next);
  assert.deepEqual(added, []);
  assert.deepEqual(removed.map((r) => r.path).sort(), [
    'components[2].existing', 'components[2].name', 'components[2].source',
  ]);
});

test('each list is sorted by path so two runs read the same', () => {
  const next = golden();
  next.slug = 'risk-report-table';
  next.states.error = 'It broke';
  const { changed } = diffWireframes(golden(), next);
  assert.deepEqual(changed.map((c) => c.path), ['slug', 'states.error']);
});

// collectRevisionNotes

const withWireframeDir = (files, body) => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-revisions-'));
  try {
    const dir = join(root, 'wireframes');
    mkdirSync(dir, { recursive: true });
    for (const [name, contents] of Object.entries(files)) {
      writeFileSync(join(dir, name), typeof contents === 'string' ? contents : JSON.stringify(contents));
    }
    return body(dir);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const wireframeWith = (slug, revisions) => ({ slug, revisions });

test('notes come back newest first across every file', () => {
  withWireframeDir({
    'a.json': wireframeWith('a', [{ at: '2026-09-01T00:00:00.000Z', kind: 'edit', note: 'oldest' }]),
    'b.json': wireframeWith('b', [
      { at: '2026-09-20T00:00:00.000Z', kind: 'redispatch', note: 'newest' },
      { at: '2026-09-10T00:00:00.000Z', kind: 'edit', note: 'middle' },
    ]),
  }, (dir) => {
    assert.deepEqual(collectRevisionNotes(dir), ['newest', 'middle', 'oldest']);
  });
});

test('limit caps the list', () => {
  withWireframeDir({
    'a.json': wireframeWith('a', [
      { at: '2026-09-03T00:00:00.000Z', kind: 'edit', note: 'three' },
      { at: '2026-09-02T00:00:00.000Z', kind: 'edit', note: 'two' },
      { at: '2026-09-01T00:00:00.000Z', kind: 'edit', note: 'one' },
    ]),
  }, (dir) => {
    assert.deepEqual(collectRevisionNotes(dir, { limit: 2 }), ['three', 'two']);
  });
});

test('exclude drops the wireframe being revised right now', () => {
  withWireframeDir({
    'a.json': wireframeWith('a', [{ at: '2026-09-01T00:00:00.000Z', kind: 'edit', note: 'from a' }]),
    'b.json': wireframeWith('b', [{ at: '2026-09-02T00:00:00.000Z', kind: 'edit', note: 'from b' }]),
  }, (dir) => {
    assert.deepEqual(collectRevisionNotes(dir, { exclude: 'b' }), ['from a']);
  });
});

test('a corrupt file is skipped rather than throwing', () => {
  // An interrupted earlier run must not block a new one.
  withWireframeDir({
    'broken.json': '{ not json',
    'good.json': wireframeWith('good', [{ at: '2026-09-01T00:00:00.000Z', kind: 'edit', note: 'survived' }]),
  }, (dir) => {
    assert.deepEqual(collectRevisionNotes(dir), ['survived']);
  });
});

test('a wireframe with no revisions contributes nothing', () => {
  withWireframeDir({ 'a.json': { slug: 'a' } }, (dir) => {
    assert.deepEqual(collectRevisionNotes(dir), []);
  });
});

test('a missing directory is an empty list, not a crash', () => {
  assert.deepEqual(collectRevisionNotes(join(tmpdir(), 'ux-engine-does-not-exist')), []);
});

test('a blank note is not a note', () => {
  withWireframeDir({
    'a.json': wireframeWith('a', [{ at: '2026-09-01T00:00:00.000Z', kind: 'edit', note: '   ' }]),
  }, (dir) => {
    assert.deepEqual(collectRevisionNotes(dir), []);
  });
});

// Found by the design dogfood: a real repository imports components through a
// module alias and without a file extension, so every reused component failed
// the existence check. Resolving the path is part of implementing the rule
// faithfully, not a new rule — and tsconfig's `paths` is where the mapping is
// declared, so nothing has to be guessed.
const withAliasedRepo = (body, { tsconfig } = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-alias-'));
  try {
    mkdirSync(join(root, 'src/components/ui'), { recursive: true });
    writeFileSync(join(root, 'src/components/ui/card.tsx'), 'export const Card = () => null;\n');
    mkdirSync(join(root, 'src/components/chart'), { recursive: true });
    writeFileSync(join(root, 'src/components/chart/index.ts'), 'export const Chart = () => null;\n');
    if (tsconfig !== null) {
      writeFileSync(join(root, 'tsconfig.json'), tsconfig ?? JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }));
    }
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const oneComponent = (source) => {
  const wf = GOOD_WIREFRAME();
  wf.components = [{ name: 'Card', source, existing: true }];
  return wf;
};

test('a module-alias source is resolved through tsconfig paths', () => {
  withAliasedRepo((root) => {
    assert.deepEqual(validateWireframe(oneComponent('@/components/ui/card'), PROFILE, { root }), []);
  });
});

test('a repo-relative source without an extension resolves', () => {
  withAliasedRepo((root) => {
    assert.deepEqual(validateWireframe(oneComponent('src/components/ui/card'), PROFILE, { root }), []);
  });
});

test('a directory with an index file resolves', () => {
  withAliasedRepo((root) => {
    assert.deepEqual(validateWireframe(oneComponent('@/components/chart'), PROFILE, { root }), []);
  });
});

test('a bare directory with no index file is not a component', () => {
  withAliasedRepo((root) => {
    const errors = validateWireframe(oneComponent('@/components/ui'), PROFILE, { root });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /no file is there/);
  });
});

test('a path that resolves to nothing is still an error', () => {
  withAliasedRepo((root) => {
    const errors = validateWireframe(oneComponent('@/components/ui/gone'), PROFILE, { root });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /no file is there/);
  });
});

test('a repo with no tsconfig still resolves repo-relative paths', () => {
  withAliasedRepo((root) => {
    assert.deepEqual(validateWireframe(oneComponent('src/components/ui/card.tsx'), PROFILE, { root }), []);
    assert.equal(validateWireframe(oneComponent('@/components/ui/card'), PROFILE, { root }).length, 1);
  }, { tsconfig: null });
});

test('an unparseable tsconfig is skipped rather than throwing', () => {
  withAliasedRepo((root) => {
    assert.deepEqual(validateWireframe(oneComponent('src/components/ui/card.tsx'), PROFILE, { root }), []);
  }, { tsconfig: '{ not json' });
});
