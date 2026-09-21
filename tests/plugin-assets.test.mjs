import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseFrontmatter } from '../scripts/lib/library.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

const assetFiles = () => {
  const files = [];
  const commandsDir = join(root, 'commands');
  if (existsSync(commandsDir)) {
    for (const f of readdirSync(commandsDir)) if (f.endsWith('.md')) files.push(join(commandsDir, f));
  }
  const skillsDir = join(root, 'skills');
  for (const d of readdirSync(skillsDir)) {
    const skill = join(skillsDir, d, 'SKILL.md');
    if (existsSync(skill)) files.push(skill);
  }
  const agentsDir = join(root, 'agents');
  if (existsSync(agentsDir)) {
    for (const f of readdirSync(agentsDir)) if (f.endsWith('.md')) files.push(join(agentsDir, f));
  }
  return files;
};

// The stack-agnostic guard below needs a wider frame than assetFiles()
// above: a hardcoded stack name is just as much a defect in a failure-mode
// or detection reference doc (skills/*/references/*.md — ~120 of these at
// full catalog size) as in a SKILL.md or command. Those reference files
// don't carry `name`/`description` frontmatter, though, so they stay out of
// assetFiles() itself — the "declares name and description" test above
// would fail them for a shape they were never meant to have.
const stackNameCheckFiles = () => {
  const files = assetFiles();
  const skillsDir = join(root, 'skills');
  for (const d of readdirSync(skillsDir)) {
    const referencesDir = join(skillsDir, d, 'references');
    if (!existsSync(referencesDir)) continue;
    for (const f of readdirSync(referencesDir)) if (f.endsWith('.md')) files.push(join(referencesDir, f));
  }
  return files;
};

test('the design-system skill and command exist', () => {
  assert.ok(existsSync(join(root, 'skills/design-system/SKILL.md')));
  assert.ok(existsSync(join(root, 'commands/ux-design-system.md')));
});

test('every command and skill declares name and description', () => {
  for (const file of assetFiles()) {
    const { data } = parseFrontmatter(readFileSync(file, 'utf8'));
    assert.ok(data.name, `${file}: missing name`);
    assert.ok(data.description && data.description.length > 20, `${file}: description too thin`);
  }
});

test('no skill or command hardcodes a stack name outside an example', () => {
  const banned = /\b(tailwind|shadcn|styled-components)\b/i;
  for (const file of stackNameCheckFiles()) {
    for (const [i, line] of readFileSync(file, 'utf8').split('\n').entries()) {
      if (line.trimStart().startsWith('>') || line.includes('e.g.')) continue;
      assert.ok(!banned.test(line), `${file}:${i + 1} hardcodes a stack: ${line.trim()}`);
    }
  }
});

test('the audit skill and both commands exist', () => {
  assert.ok(existsSync(join(root, 'skills/ux-audit/SKILL.md')));
  assert.ok(existsSync(join(root, 'commands/ux-audit.md')));
  assert.ok(existsSync(join(root, 'commands/ux-review.md')));
});

test('the audit skill routes every mechanical step through a script', () => {
  const skill = readFileSync(join(root, 'skills/ux-audit/SKILL.md'), 'utf8');
  for (const script of ['check-profile.mjs', 'scan-off-system.mjs', 'report-findings.mjs']) {
    assert.match(skill, new RegExp(script.replace('.', '\\.')), `skill must call ${script}`);
  }
  assert.match(skill, /INDEX\.md/, 'skill must read the index before any mode file');
});

test('the review command scopes to the diff and the audit command to a path', () => {
  assert.match(readFileSync(join(root, 'commands/ux-review.md'), 'utf8'), /--scope diff/);
  assert.match(readFileSync(join(root, 'commands/ux-audit.md'), 'utf8'), /--scope path/);
});

test('the restyle skill and command exist', () => {
  assert.ok(existsSync(join(root, 'skills/ux-restyle/SKILL.md')));
  assert.ok(existsSync(join(root, 'commands/ux-restyle.md')));
});

test('the restyle skill routes every mechanical step through a script', () => {
  const skill = readFileSync(join(root, 'skills/ux-restyle/SKILL.md'), 'utf8');
  for (const script of ['check-profile.mjs', 'scan-off-system.mjs', 'report-findings.mjs', 'restyle.mjs']) {
    assert.match(skill, new RegExp(script.replace('.', '\\.')), `skill must call ${script}`);
  }
});

test('the restyle skill previews before it writes', () => {
  const skill = readFileSync(join(root, 'skills/ux-restyle/SKILL.md'), 'utf8');
  const preview = skill.indexOf('--dry-run');
  assert.ok(preview > -1, 'skill must run a dry run');
  assert.ok(preview < skill.indexOf('without `--dry-run`'), 'the dry run must come first');
});

test('the restyle skill refuses to reuse a stale findings file', () => {
  const skill = readFileSync(join(root, 'skills/ux-restyle/SKILL.md'), 'utf8');
  assert.match(skill, /\.ux-engine\/findings\.json/);
  assert.match(skill, /do not reuse/i);
});

test('both subagents exist and declare their tools', () => {
  for (const name of ['ux-wireframer', 'ux-system-enforcer']) {
    const file = join(root, `agents/${name}.md`);
    assert.ok(existsSync(file), `${file} missing`);
    const { data } = parseFrontmatter(readFileSync(file, 'utf8'));
    assert.equal(data.name, name);
    assert.ok(typeof data.tools === 'string' && data.tools.trim(), `${name}: missing tools`);
  }
});

test('the wireframer has no way to write files', () => {
  // A wireframer that can edit is a wireframer that will start implementing,
  // which collapses stages 2 and 4 and skips the approval between them.
  const { data } = parseFrontmatter(readFileSync(join(root, 'agents/ux-wireframer.md'), 'utf8'));
  const tools = data.tools.split(',').map((t) => t.trim());
  for (const banned of ['Write', 'Edit', 'NotebookEdit', 'Bash']) {
    assert.ok(!tools.includes(banned), `ux-wireframer must not have ${banned}`);
  }
});

test('the enforcer can run scripts but cannot edit', () => {
  const { data } = parseFrontmatter(readFileSync(join(root, 'agents/ux-system-enforcer.md'), 'utf8'));
  const tools = data.tools.split(',').map((t) => t.trim());
  assert.ok(tools.includes('Bash'), 'the enforcer runs the scanner');
  for (const banned of ['Write', 'Edit', 'NotebookEdit']) {
    assert.ok(!tools.includes(banned), `ux-system-enforcer must not have ${banned}`);
  }
});
