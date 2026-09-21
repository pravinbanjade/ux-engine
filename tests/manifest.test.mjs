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

test('the plugin ships the restyle command', () => {
  // A command file with no entry in the README is a command nobody finds.
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  assert.match(readme, /\/ux-restyle/);
});

test('the plugin ships the design command', () => {
  // A command file with no entry in the README is a command nobody finds.
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  assert.match(readme, /\/ux-design\b/);
});

test('the README documents the wireframe artifact', () => {
  // It is the only thing /ux-design writes that the user did not ask for by
  // name, so it belongs in the table of what lands in their repo.
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  assert.match(readme, /\.ux-engine\/wireframes\//);
});
