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
  for (const file of assetFiles()) {
    for (const [i, line] of readFileSync(file, 'utf8').split('\n').entries()) {
      if (line.trimStart().startsWith('>') || line.includes('e.g.')) continue;
      assert.ok(!banned.test(line), `${file}:${i + 1} hardcodes a stack: ${line.trim()}`);
    }
  }
});
