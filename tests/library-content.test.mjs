import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadModes, validateModeFile, checkIndex, CATEGORIES } from '../scripts/lib/library.mjs';

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

test('at least 20 modes are seeded', () => {
  assert.ok(modes.length >= 20, `only ${modes.length} modes`);
});

test('every category has at least two modes', () => {
  for (const category of CATEGORIES) {
    const count = modes.filter((m) => m.data.category === category).length;
    assert.ok(count >= 2, `category ${category} has ${count} mode(s)`);
  }
});

test('all three detection kinds are represented', () => {
  for (const kind of ['model', 'scanner', 'hybrid']) {
    assert.ok(modes.some((m) => m.data.detection === kind), `no ${kind} mode`);
  }
});

test('the scanner modes the scanner emits exist', () => {
  for (const id of ['UX-101', 'UX-102', 'UX-103']) {
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
  const skill = readFileSync(fileURLToPath(new URL('../skills/ux-audit/SKILL.md', import.meta.url)), 'utf8');
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

import { APPLIES_TO, CATEGORY_RANGES } from '../scripts/lib/library.mjs';

test('every appliesTo value in the catalog is in the vocabulary', () => {
  for (const m of modes) {
    for (const kind of m.data.appliesTo) {
      assert.ok(APPLIES_TO.includes(kind), `${m.filename}: "${kind}" is not in APPLIES_TO`);
    }
  }
});

test('every mode ID sits in its category range', () => {
  for (const m of modes) {
    const [lo, hi] = CATEGORY_RANGES[m.data.category];
    const n = Number(m.data.id.slice(3));
    assert.ok(n >= lo && n <= hi, `${m.filename}: ${m.data.id} outside ${m.data.category} ${lo}-${hi}`);
  }
});

import { checkCrossFile } from '../scripts/lib/library.mjs';

test('no two modes duplicate an id, a title, or a signal', () => {
  assert.deepEqual(checkCrossFile(modes), []);
});
