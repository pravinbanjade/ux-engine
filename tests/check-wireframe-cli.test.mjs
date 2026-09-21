import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const cli = join(repoRoot, 'scripts/check-wireframe.mjs');
const profileSnapshot = join(repoRoot, 'tests/snapshots/tailwind-shadcn.profile.json');
const goldenPath = join(repoRoot, 'tests/fixtures/wireframes/risk-report-list.json');

const run = (args) => spawnSync('node', [cli, ...args], { encoding: 'utf8' });

// A throwaway repo with a real profile, a real wireframe, and the one
// component the golden wireframe claims to reuse.
const withRepo = (body, { wireframe } = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-check-wireframe-'));
  try {
    mkdirSync(join(root, '.ux-engine/wireframes'), { recursive: true });
    mkdirSync(join(root, 'src/components/ui'), { recursive: true });
    writeFileSync(join(root, 'src/components/ui/data-table.tsx'), 'export const DataTable = () => null;\n');
    writeFileSync(join(root, 'src/components/ui/select.tsx'), 'export const Select = () => null;\n');
    cpSync(profileSnapshot, join(root, '.ux-engine/profile.json'));
    const wf = wireframe ?? JSON.parse(readFileSync(goldenPath, 'utf8'));
    const wfPath = join(root, '.ux-engine/wireframes/risk-report-list.json');
    writeFileSync(wfPath, typeof wf === 'string' ? wf : JSON.stringify(wf, null, 2));
    return body({ root, wfPath, profile: join(root, '.ux-engine/profile.json') });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test('a valid wireframe exits 0', () => {
  withRepo(({ root, wfPath, profile }) => {
    const r = run(['--wireframe', wfPath, '--profile', profile, '--root', root]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Wireframe is valid/);
  });
});

test('missing flags exit 1 with the usage line', () => {
  const r = run([]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Usage: check-wireframe\.mjs/);
});

test('a missing profile exits 3 with the standard remedy', () => {
  withRepo(({ root, wfPath }) => {
    const r = run(['--wireframe', wfPath, '--profile', join(root, 'nope.json'), '--root', root]);
    assert.equal(r.status, 3);
    assert.match(r.stderr, /Run \/ux-design-system first/);
  });
});

test('an invalid profile exits 3, not 2 — a broken profile is not a broken wireframe', () => {
  withRepo(({ root, wfPath, profile }) => {
    writeFileSync(profile, JSON.stringify({ version: 1 }));
    const r = run(['--wireframe', wfPath, '--profile', profile, '--root', root]);
    assert.equal(r.status, 3);
  });
});

test('an unreadable wireframe exits 2', () => {
  withRepo(({ root, wfPath, profile }) => {
    const r = run(['--wireframe', wfPath, '--profile', profile, '--root', root]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Could not read --wireframe JSON/);
  }, { wireframe: '{ not json' });
});

test('an invalid wireframe exits 2 and prints one error per line', () => {
  withRepo(({ root, wfPath, profile }) => {
    const r = run(['--wireframe', wfPath, '--profile', profile, '--root', root]);
    assert.equal(r.status, 2);
    const lines = r.stderr.trim().split('\n');
    assert.deepEqual(lines.sort(), ['intent.who: not answered', 'states.error: must describe what the user sees']);
  }, {
    wireframe: (() => {
      const wf = JSON.parse(readFileSync(goldenPath, 'utf8'));
      wf.intent.who = '';
      wf.states.error = '';
      return wf;
    })(),
  });
});

test('--root is what turns on the component-existence check', () => {
  withRepo(({ wfPath, profile }) => {
    // Same wireframe, no --root: the missing component is not looked for.
    const without = run(['--wireframe', wfPath, '--profile', profile]);
    assert.equal(without.status, 0, without.stderr);
  }, {
    wireframe: (() => {
      const wf = JSON.parse(readFileSync(goldenPath, 'utf8'));
      wf.components[0].source = 'src/components/ui/gone.tsx';
      return wf;
    })(),
  });
});

test('--root reports the component that is not on disk', () => {
  withRepo(({ root, wfPath, profile }) => {
    const r = run(['--wireframe', wfPath, '--profile', profile, '--root', root]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /gone\.tsx" is marked existing but no file is there/);
  }, {
    wireframe: (() => {
      const wf = JSON.parse(readFileSync(goldenPath, 'utf8'));
      wf.components[0].source = 'src/components/ui/gone.tsx';
      return wf;
    })(),
  });
});

test('--intent-only passes a stub that has no layout yet', () => {
  withRepo(({ root, wfPath, profile }) => {
    const r = run(['--wireframe', wfPath, '--profile', profile, '--root', root, '--intent-only']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Intent is complete/);
  }, {
    wireframe: {
      version: 1,
      slug: 'risk-report-list',
      intent: JSON.parse(readFileSync(goldenPath, 'utf8')).intent,
    },
  });
});

test('--intent-only names the questions that were not answered', () => {
  withRepo(({ root, wfPath, profile }) => {
    const r = run(['--wireframe', wfPath, '--profile', profile, '--root', root, '--intent-only']);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /intent\.failure: not answered/);
    assert.match(r.stderr, /intent\.scale: not answered/);
    assert.ok(!/layout/.test(r.stderr), 'intent-only must not complain about the missing layout');
  }, {
    wireframe: {
      version: 1,
      slug: 'risk-report-list',
      intent: { who: 'Risk analysts on the desk', cadence: 'Several times an hour', primaryAction: 'Run a fresh report' },
    },
  });
});
