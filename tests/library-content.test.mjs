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
