import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const root = fileURLToPath(new URL('../', import.meta.url));

test('plugin manifest declares required fields', () => {
  const m = read('../.claude-plugin/plugin.json');
  assert.equal(m.name, 'ux-engine');
  assert.match(m.version, /^\d+\.\d+\.\d+$/);
  assert.ok(m.description.length > 20, 'description must be meaningful');
});

test('marketplace manifest lists this plugin from the repo root', () => {
  const m = read('../.claude-plugin/marketplace.json');
  assert.equal(m.name, 'ux-engine');
  assert.equal(m.plugins.length, 1);
  assert.equal(m.plugins[0].name, 'ux-engine');
  assert.equal(m.plugins[0].source, './');
});

test('package is zero-dependency ESM', () => {
  const p = read('../package.json');
  assert.equal(p.type, 'module');
  assert.equal(p.dependencies, undefined);
  assert.equal(p.devDependencies, undefined);
  assert.equal(p.scripts.test, 'node --test "tests/**/*.test.mjs"');
});

test('the plugin and package versions agree', () => {
  const plugin = JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(plugin.version, pkg.version);
});

test('CI runs the test suite and the library lint', () => {
  const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
  assert.match(workflow, /npm test/);
  assert.match(workflow, /lint:library/);
});
