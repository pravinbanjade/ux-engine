import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../tests/fixtures', import.meta.url));
const FIXTURES = ['tailwind-shadcn', 'css-modules', 'styled-components'];

test('every fixture has a package manifest and an offender component', () => {
  for (const f of FIXTURES) {
    assert.ok(existsSync(join(root, f, 'package.json')), `${f}: no package.json`);
    assert.ok(existsSync(join(root, f, 'src/components/Offender.tsx')), `${f}: no Offender.tsx`);
  }
});

test('every offender plants one colour, one spacing and one duration violation', () => {
  for (const f of FIXTURES) {
    const text = readFileSync(join(root, f, 'src/components/Offender.tsx'), 'utf8');
    assert.match(text, /#[0-9a-fA-F]{6}/, `${f}: no planted colour literal`);
    assert.match(text, /\d+px/, `${f}: no planted pixel value`);
    assert.match(text, /\d+ms/, `${f}: no planted duration`);
  }
});

test('fixtures are not installable packages', () => {
  for (const f of FIXTURES) {
    const p = JSON.parse(readFileSync(join(root, f, 'package.json'), 'utf8'));
    assert.equal(p.private, true, `${f}: fixture must be private`);
  }
});
