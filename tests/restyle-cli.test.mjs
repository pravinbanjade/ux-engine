import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const cli = join(repoRoot, 'scripts/restyle.mjs');
const profileSnapshot = join(repoRoot, 'tests/snapshots/tailwind-shadcn.profile.json');

// Both literals are hand-written copies of a token — the colour of
// --color-primary (distance 0.001), the padding of --spacing-4 — because
// restyle writes a token only when the page would look the same.
const OFFENDING_LINE = "const s = { color: '#03893e', padding: '1rem' };";

// A git repo holding one offending file, a DESIGN.md and a profile, with
// everything committed so the working tree starts clean.
const withGitRepo = (body, { commit = true } = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-restyle-cli-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/A.tsx'), `${OFFENDING_LINE}\n`);
    writeFileSync(join(root, 'DESIGN.md'), '# Design System\n\n## Deliberate Exceptions\n\n_None recorded._\n');
    mkdirSync(join(root, '.ux-engine'), { recursive: true });
    cpSync(profileSnapshot, join(root, '.ux-engine/profile.json'));
    const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    if (commit) {
      git('add', '-A');
      git('commit', '-qm', 'seed');
    }
    return body(root, git);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

// Generate a real envelope the same way the skill does, so these tests
// exercise the actual scanner-to-report-to-restyle chain rather than a
// hand-written findings file that could drift from it.
const buildEnvelopeFor = (root) => {
  const scanPath = join(root, 'scan.json');
  const scan = execFileSync('node', [
    join(repoRoot, 'scripts/scan-off-system.mjs'),
    '--profile', join(root, '.ux-engine/profile.json'),
    '--root', root,
  ], { encoding: 'utf8' });
  writeFileSync(scanPath, scan);
  const out = join(root, 'findings.json');
  execFileSync('node', [
    join(repoRoot, 'scripts/report-findings.mjs'),
    '--scanner', scanPath,
    '--profile', join(root, '.ux-engine/profile.json'),
    '--root', root, '--out', out,
  ], { encoding: 'utf8' });
  return out;
};

test('exits 1 with usage when --findings is missing', () => {
  const result = spawnSync('node', [cli, '--profile', profileSnapshot], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: restyle\.mjs/);
});

test('exits 3 when the profile is missing', () => {
  withGitRepo((root) => {
    const findings = buildEnvelopeFor(root);
    const result = spawnSync('node', [cli, '--findings', findings, '--profile', join(root, 'nope.json'), '--root', root], { encoding: 'utf8' });
    assert.equal(result.status, 3);
    assert.match(result.stderr, /ux-design-system/);
  });
});

test('exits 5 when DESIGN.md is absent', () => {
  withGitRepo((root) => {
    const findings = buildEnvelopeFor(root);
    rmSync(join(root, 'DESIGN.md'));
    const result = spawnSync('node', [cli, '--findings', findings, '--profile', join(root, '.ux-engine/profile.json'), '--root', root], { encoding: 'utf8' });
    assert.equal(result.status, 5);
    assert.match(result.stderr, /DESIGN\.md/);
  });
});

test('exits 4 on an envelope from a newer schema', () => {
  withGitRepo((root) => {
    const findings = join(root, 'future.json');
    writeFileSync(findings, JSON.stringify({ version: 99, findings: [] }));
    const result = spawnSync('node', [cli, '--findings', findings, '--profile', join(root, '.ux-engine/profile.json'), '--root', root], { encoding: 'utf8' });
    assert.equal(result.status, 4);
    assert.match(result.stderr, /newer/);
  });
});

test('exits 7 when a file the plan would touch has uncommitted changes', () => {
  withGitRepo((root) => {
    const findings = buildEnvelopeFor(root);
    writeFileSync(join(root, 'src/A.tsx'), `${OFFENDING_LINE}\n// edited\n`);
    const result = spawnSync('node', [cli, '--findings', findings, '--profile', join(root, '.ux-engine/profile.json'), '--root', root], { encoding: 'utf8' });
    assert.equal(result.status, 7);
    assert.match(result.stderr, /src\/A\.tsx/);
  });
});

test('--allow-dirty overrides the working-tree refusal', () => {
  withGitRepo((root) => {
    const findings = buildEnvelopeFor(root);
    writeFileSync(join(root, 'src/A.tsx'), `${OFFENDING_LINE}\n// edited\n`);
    const result = spawnSync('node', [cli, '--findings', findings, '--profile', join(root, '.ux-engine/profile.json'), '--root', root, '--allow-dirty', '--dry-run'], { encoding: 'utf8' });
    assert.equal(result.status, 0);
  });
});

test('--dry-run prints the plan and writes nothing', () => {
  withGitRepo((root) => {
    const findings = buildEnvelopeFor(root);
    const before = readFileSync(join(root, 'src/A.tsx'), 'utf8');
    const result = spawnSync('node', [cli, '--findings', findings, '--profile', join(root, '.ux-engine/profile.json'), '--root', root, '--dry-run'], { encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /# UX restyle plan/);
    assert.match(result.stdout, /var\(--color-primary\)/);
    assert.equal(readFileSync(join(root, 'src/A.tsx'), 'utf8'), before);
  });
});

test('a real run substitutes both literals and verifies itself', () => {
  withGitRepo((root) => {
    const findings = buildEnvelopeFor(root);
    const result = spawnSync('node', [cli, '--findings', findings, '--profile', join(root, '.ux-engine/profile.json'), '--root', root], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(join(root, 'src/A.tsx'), 'utf8'),
      "const s = { color: 'var(--color-primary)', padding: 'var(--spacing-4)' };\n",
    );
    assert.match(result.stdout, /verified/i);
  });
});

test('--json prints the plan as JSON', () => {
  withGitRepo((root) => {
    const findings = buildEnvelopeFor(root);
    const result = spawnSync('node', [cli, '--findings', findings, '--profile', join(root, '.ux-engine/profile.json'), '--root', root, '--dry-run', '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 0);
    const plan = JSON.parse(result.stdout);
    assert.ok(Array.isArray(plan.edits));
    assert.ok(plan.edits.length >= 2);
  });
});

test('a repo that is not a git repo is restyled without a working-tree check', () => {
  // Refusing here would make the command unusable outside git for no
  // safety gain: there is nothing to diff against either way.
  const root = mkdtempSync(join(tmpdir(), 'ux-engine-restyle-nogit-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/A.tsx'), `${OFFENDING_LINE}\n`);
    writeFileSync(join(root, 'DESIGN.md'), '# Design System\n');
    mkdirSync(join(root, '.ux-engine'), { recursive: true });
    cpSync(profileSnapshot, join(root, '.ux-engine/profile.json'));
    const findings = buildEnvelopeFor(root);
    const result = spawnSync('node', [cli, '--findings', findings, '--profile', join(root, '.ux-engine/profile.json'), '--root', root, '--dry-run'], { encoding: 'utf8' });
    assert.equal(result.status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
