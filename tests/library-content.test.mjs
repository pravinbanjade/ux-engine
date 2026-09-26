import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadModes, validateModeFile, checkIndex, CATEGORIES, CATEGORY_RANGES, CATALOG_SIZE, inCategoryRange } from '../scripts/lib/library.mjs';

const dir = fileURLToPath(new URL('../skills/failure-modes/references', import.meta.url));
const modes = loadModes(dir);

test('every mode file is valid', () => {
  const errors = modes.flatMap((m) => validateModeFile(m));
  assert.deepEqual(errors, []);
});

test('the index is in sync', () => {
  const index = readFileSync(join(dir, 'INDEX.md'), 'utf8');
  assert.deepEqual(checkIndex(modes, index), []);
});

test('the catalog is complete: IDs 001-CATALOG_SIZE, each exactly once', () => {
  const nums = modes.map((m) => Number(m.data.id.slice(3))).sort((a, b) => a - b);
  assert.equal(nums.length, CATALOG_SIZE, `catalog holds ${nums.length} modes`);
  for (let n = 1; n <= CATALOG_SIZE; n++) {
    assert.equal(nums[n - 1], n, `UX-${String(n).padStart(3, '0')} is missing or duplicated`);
  }
});

test('every category fills its declared ranges exactly', () => {
  for (const category of CATEGORIES) {
    const found = modes
      .filter((m) => m.data.category === category)
      .map((m) => Number(m.data.id.slice(3)))
      .sort((a, b) => a - b);
    const expected = CATEGORY_RANGES[category]
      .flatMap(([lo, hi]) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i));
    assert.deepEqual(found, expected, `${category} does not fill its ranges`);
  }
});

test('all four detection kinds are represented', () => {
  for (const kind of ['model', 'scanner', 'hybrid', 'conformance']) {
    assert.ok(modes.some((m) => m.data.detection === kind), `no ${kind} mode`);
  }
});

test('the scanner modes the scanner emits exist', () => {
  for (const id of ['UX-101', 'UX-102', 'UX-103', 'UX-121', 'UX-122', 'UX-123']) {
    const mode = modes.find((m) => m.data.id === id);
    assert.ok(mode, `${id} missing`);
    assert.equal(mode.data.detection, 'scanner');
  }
});

test('no counter-example section is left empty', () => {
  for (const m of modes) {
    const section = m.body.split('## Counter-example — when this is fine')[1] ?? '';
    assert.ok(section.trim().length > 80, `${m.filename}: counter-example too thin`);
  }
});

// This plugin is stack-agnostic: entries must describe shapes and mechanisms,
// never name the toolchain that produced them. Word-boundary, case-insensitive
// matching on the raw line so a hyphenated product name (e.g. "styled-components")
// can't be hidden by splitting on the hyphen.
const BANNED_TERMS = ['tailwind', 'shadcn', 'styled-components', 'bootstrap', 'chakra', 'mui', 'vue', 'svelte'];
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('no mode names a specific framework or design-system product', () => {
  for (const m of modes) {
    const lines = m.text.split('\n');
    for (const term of BANNED_TERMS) {
      const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
      for (const line of lines) {
        assert.ok(!re.test(line), `${m.filename}: mentions "${term}" -> "${line.trim()}"`);
      }
    }
  }
});

test('the three conformance modes exist and are detected as conformance', () => {
  for (const id of ['UX-111', 'UX-112', 'UX-113']) {
    const mode = modes.find((m) => m.data.id === id);
    assert.ok(mode, `${id} missing`);
    assert.equal(mode.data.category, 'conformance');
    assert.equal(mode.data.detection, 'conformance');
  }
});

test('the audit skill excludes conformance and scanner modes when selecting', () => {
  // /ux-audit has no approved wireframe, so a conformance mode has nothing to
  // compare against, and the scanner already reported its own modes in step 2.
  // Both exclusions now travel as selector flags rather than prose the reader
  // has to remember to apply.
  const skill = readFileSync(fileURLToPath(new URL('../skills/audit-ui/SKILL.md', import.meta.url)), 'utf8');
  assert.match(skill, /--exclude-detection scanner,conformance/);
  assert.ok(!/Read `\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/failure-modes\/references\/INDEX\.md`/.test(skill),
    'the audit should select, not read the whole index');
});

test('the enforcer selects rather than reading the whole index', () => {
  const agent = readFileSync(fileURLToPath(new URL('../agents/ux-system-enforcer.md', import.meta.url)), 'utf8');
  assert.match(agent, /select-modes\.mjs/);
  assert.match(agent, /--exclude-detection scanner,conformance/);
});

test('the enforcer names every conformance mode', () => {
  const agent = readFileSync(fileURLToPath(new URL('../agents/ux-system-enforcer.md', import.meta.url)), 'utf8');
  for (const n of [111, 112, 113, 114, 115, 116, 117, 118, 119, 120]) {
    assert.match(agent, new RegExp(`UX-${n}`), `enforcer does not mention UX-${n}`);
  }
});

import { APPLIES_TO } from '../scripts/lib/library.mjs';

test('every appliesTo value in the catalog is in the vocabulary', () => {
  for (const m of modes) {
    for (const kind of m.data.appliesTo) {
      assert.ok(APPLIES_TO.includes(kind), `${m.filename}: "${kind}" is not in APPLIES_TO`);
    }
  }
});

test('every mode ID sits in its category range', () => {
  for (const m of modes) {
    const n = Number(m.data.id.slice(3));
    assert.ok(inCategoryRange(m.data.category, n), `${m.filename}: ${m.data.id} outside ${m.data.category}`);
  }
});

import { checkCrossFile } from '../scripts/lib/library.mjs';
import { GROUP_TO_ID } from '../scripts/lib/scanner.mjs';

test('no two modes duplicate an id, a title, or a signal', () => {
  assert.deepEqual(checkCrossFile(modes), []);
});

// Each length scale resolves to a mode about that scale. When one mode
// covered all four, its title had to stay neutral and a container width was
// reported under advice that also had to fit a font size — a reader looking
// up why an off-scale radius matters found a page about four things at once.
// The scanner's own map is the source of truth here, so a fifth scale added
// there without a mode of its own fails this test rather than a report.
test('every length scale the scanner measures has a mode titled for it', () => {
  const lengthGroups = Object.keys(GROUP_TO_ID).filter((g) => !['color', 'motion'].includes(g));
  assert.deepEqual(lengthGroups.sort(), ['radius', 'sizing', 'spacing', 'type']);
  const TITLE_WORD = { spacing: /spacing/i, sizing: /size|sizing|width|dimension/i, radius: /radius|corner/i, type: /type|font/i };
  const seen = new Set();
  for (const group of lengthGroups) {
    const id = GROUP_TO_ID[group];
    assert.ok(!seen.has(id), `${group} shares ${id} with another scale`);
    seen.add(id);
    const mode = modes.find((m) => m.data.id === id);
    assert.ok(mode, `${id} (${group}) missing`);
    assert.equal(mode.data.detection, 'scanner');
    assert.match(mode.data.title, TITLE_WORD[group], `${id}'s title does not name the ${group} scale`);
  }
});
