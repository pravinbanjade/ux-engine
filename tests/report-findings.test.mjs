import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildProfile } from '../scripts/lib/profile.mjs';

const cli = fileURLToPath(new URL('../scripts/report-findings.mjs', import.meta.url));
const fixture = fileURLToPath(new URL('../tests/fixtures/tailwind-shadcn/', import.meta.url));

// Runs the CLI and returns {status, stdout, stderr} instead of throwing, so
// exit codes can be asserted as behaviour rather than caught as errors.
// spawnSync rather than execFileSync: stderr has to be captured on a
// *successful* run too, because a warning that does not stop the audit is
// exactly the thing worth asserting.
function run(args, cwd) {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function workspace() {
  const dir = mkdtempSync(join(tmpdir(), 'uxe-report-'));
  const profile = buildProfile(fixture);
  mkdirSync(join(dir, '.ux-engine'), { recursive: true });
  writeFileSync(join(dir, 'profile.json'), JSON.stringify(profile, null, 2));
  const scan = execFileSync(process.execPath, [
    fileURLToPath(new URL('../scripts/scan-off-system.mjs', import.meta.url)),
    '--profile', join(dir, 'profile.json'), '--root', fixture,
  ], { encoding: 'utf8' });
  writeFileSync(join(dir, 'scan.json'), scan);
  return dir;
}

const base = (dir) => ['--scanner', join(dir, 'scan.json'), '--profile', join(dir, 'profile.json'), '--root', dir];

test('the CLI prints a report and writes the envelope', () => {
  const dir = workspace();
  const { status, stdout } = run(base(dir), dir);
  assert.equal(status, 0);
  assert.match(stdout, /# UX findings/);
  const envelope = JSON.parse(readFileSync(join(dir, '.ux-engine/findings.json'), 'utf8'));
  assert.equal(envelope.version, 1);
  assert.ok(envelope.findings.length > 0, 'the fixture plants off-system values');
  assert.ok(envelope.profileHash.length === 64, 'profileHash is a sha256 hex digest');
  rmSync(dir, { recursive: true, force: true });
});

test('--json prints the envelope instead of the report', () => {
  const dir = workspace();
  const { stdout } = run([...base(dir), '--json'], dir);
  assert.equal(JSON.parse(stdout).version, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('a missing profile exits 3 and names the remedy', () => {
  const dir = workspace();
  const { status, stderr } = run(['--scanner', join(dir, 'scan.json'), '--profile', join(dir, 'nope.json'), '--root', dir], dir);
  assert.equal(status, 3);
  assert.match(stderr, /ux-design-system/);
  rmSync(dir, { recursive: true, force: true });
});

test('an invalid profile exits 3', () => {
  const dir = workspace();
  writeFileSync(join(dir, 'bad.json'), '{"version": 1}');
  const { status } = run(['--scanner', join(dir, 'scan.json'), '--profile', join(dir, 'bad.json'), '--root', dir], dir);
  assert.equal(status, 3);
  rmSync(dir, { recursive: true, force: true });
});

test('a missing --scanner flag is a usage error', () => {
  const dir = workspace();
  const { status, stderr } = run(['--profile', join(dir, 'profile.json')], dir);
  assert.equal(status, 1);
  assert.match(stderr, /Usage/);
  rmSync(dir, { recursive: true, force: true });
});

test('invalid model findings exit 4 and name every defect', () => {
  const dir = workspace();
  writeFileSync(join(dir, 'model.json'), JSON.stringify([
    { id: 'UX-999', file: 'a.tsx', line: 1, evidence: 'e' },
    { id: 'UX-046', file: '', line: 1, evidence: 'e' },
  ]));
  const { status, stderr } = run([...base(dir), '--model', join(dir, 'model.json')], dir);
  assert.equal(status, 4);
  assert.match(stderr, /UX-999/);
  assert.match(stderr, /file/);
  rmSync(dir, { recursive: true, force: true });
});

test('valid model findings are merged into the report', () => {
  const dir = workspace();
  writeFileSync(join(dir, 'model.json'), JSON.stringify([
    { id: 'UX-046', file: 'src/components/UserList.tsx', line: null, evidence: 'renders rows only', message: 'List has no empty state.' },
  ]));
  const { stdout } = run([...base(dir), '--model', join(dir, 'model.json')], dir);
  assert.match(stdout, /UX-046/);
  assert.match(stdout, /List has no empty state\./);
  rmSync(dir, { recursive: true, force: true });
});

test('an exception in DESIGN.md removes matching findings and is counted', () => {
  const dir = workspace();
  const before = JSON.parse(run([...base(dir), '--json'], dir).stdout);
  const victim = before.findings[0];
  writeFileSync(join(dir, 'DESIGN.md'), [
    '# Design System', '', '## Deliberate Exceptions', '',
    'One per line: `<mode-id or *> | <glob> | <reason>`', '',
    `${victim.id} | ${victim.file} | deliberate for this test`, '',
  ].join('\n'));
  const after = JSON.parse(run([...base(dir), '--design', join(dir, 'DESIGN.md'), '--json'], dir).stdout);
  assert.ok(after.exceptionsApplied > 0);
  assert.ok(after.findings.length < before.findings.length);
  assert.ok(!after.findings.some((x) => x.id === victim.id && x.file === victim.file));
  rmSync(dir, { recursive: true, force: true });
});

test('a malformed exception line is warned about, not silently ignored', () => {
  const dir = workspace();
  writeFileSync(join(dir, 'DESIGN.md'), '# Design System\n\n## Deliberate Exceptions\n\nux-1 | src/** | typo\n');
  const { status, stderr } = run([...base(dir), '--design', join(dir, 'DESIGN.md')], dir);
  assert.equal(status, 0);
  assert.match(stderr, /line 5/);
  rmSync(dir, { recursive: true, force: true });
});

test('--fail-on exits 2 when a finding meets the threshold', () => {
  const dir = workspace();
  writeFileSync(join(dir, 'model.json'), JSON.stringify([
    { id: 'UX-046', file: 'src/components/UserList.tsx', line: null, evidence: 'renders rows only' },
  ]));
  const { status } = run([...base(dir), '--model', join(dir, 'model.json'), '--fail-on', 'high'], dir);
  assert.equal(status, 2);
  rmSync(dir, { recursive: true, force: true });
});

test('--fail-on exits 0 when nothing reaches the threshold', () => {
  const dir = workspace();
  // The fixture plants one high (UX-101), one medium and one low, all on the
  // same line. Excepting the high one leaves findings that are real but below
  // the threshold — which is what "nothing reaches it" has to mean here, and
  // proves the comparison rather than an empty list.
  writeFileSync(join(dir, 'DESIGN.md'), [
    '# Design System', '', '## Deliberate Exceptions', '',
    'UX-101 | src/components/Offender.tsx | planted for this test', '',
  ].join('\n'));
  const args = [...base(dir), '--design', join(dir, 'DESIGN.md')];
  const envelope = JSON.parse(run([...args, '--json'], dir).stdout);
  assert.ok(envelope.findings.length > 0, 'medium and low findings survive the exception');
  assert.ok(!envelope.findings.some((x) => x.severity === 'high'));
  assert.equal(run([...args, '--fail-on', 'high'], dir).status, 0);
  assert.equal(run([...args, '--fail-on', 'medium'], dir).status, 2);
  rmSync(dir, { recursive: true, force: true });
});

test('--scope diff limits findings to changed lines', () => {
  const dir = workspace();
  // A git repo holding the fixture plus a second offending file. The fixture
  // alone plants every violation on one line of one file, so scoping to a
  // one-line edit would exclude nothing and prove nothing; the second file is
  // what the diff scope has to leave out.
  const repo = mkdtempSync(join(tmpdir(), 'uxe-scope-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  execFileSync('cp', ['-R', `${fixture}.`, repo]);
  writeFileSync(
    join(repo, 'src/components/Untouched.tsx'),
    'export function Untouched() {\n  return <div style={{ color: \'#8a2f6b\' }}>untouched</div>;\n}\n',
  );
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: repo });

  // Scan the repo itself — the workspace scan covers the fixture only.
  const scan = execFileSync(process.execPath, [
    fileURLToPath(new URL('../scripts/scan-off-system.mjs', import.meta.url)),
    '--profile', join(dir, 'profile.json'), '--root', repo,
  ], { encoding: 'utf8' });
  writeFileSync(join(repo, 'scan.json'), scan);
  const repoArgs = ['--scanner', join(repo, 'scan.json'), '--profile', join(dir, 'profile.json'), '--root', repo];

  const all = JSON.parse(run([...repoArgs, '--json'], repo).stdout);
  assert.ok(all.findings.some((x) => x.file === 'src/components/Untouched.tsx'));
  const target = all.findings.find((x) => x.file === 'src/components/Offender.tsx');

  const lines = readFileSync(join(repo, target.file), 'utf8').split('\n');
  lines[target.line - 1] = `${lines[target.line - 1]} // touched`;
  writeFileSync(join(repo, target.file), lines.join('\n'));

  const scoped = JSON.parse(run([...repoArgs, '--scope', 'diff', '--json'], repo).stdout);
  assert.equal(scoped.scope.kind, 'diff');
  assert.ok(scoped.findings.some((x) => x.file === target.file && x.line === target.line));
  assert.ok(!scoped.findings.some((x) => x.file === 'src/components/Untouched.tsx'),
    'an untouched file contributes nothing to a diff-scoped audit');
  assert.ok(scoped.findings.length < all.findings.length);
  rmSync(dir, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

test('--path with --scope diff is an argument error', () => {
  const dir = workspace();
  const { status, stderr } = run([...base(dir), '--scope', 'diff', '--path', 'src'], dir);
  assert.equal(status, 1);
  assert.match(stderr, /--path/);
  rmSync(dir, { recursive: true, force: true });
});

test('the rendered report matches its committed snapshot', () => {
  const dir = workspace();
  const { stdout } = run(base(dir), dir);
  const snapshot = readFileSync(fileURLToPath(new URL('./snapshots/report-tailwind-shadcn.md', import.meta.url)), 'utf8');
  assert.equal(stdout, snapshot);
  rmSync(dir, { recursive: true, force: true });
});

test('the CLI carries the scanner suppressions into the envelope and the report', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ux-engine-suppressed-'));
  try {
    const scan = {
      findings: [],
      skipped: [],
      suppressed: [{ id: 'UX-102', groups: ['spacing'], distinctValues: 2, count: 12 }],
    };
    writeFileSync(join(dir, 'scan.json'), JSON.stringify(scan));
    const out = join(dir, 'findings.json');
    const profileSnapshot = fileURLToPath(new URL('../tests/snapshots/tailwind-shadcn.profile.json', import.meta.url));
    const result = spawnSync('node', [
      cli,
      '--scanner', join(dir, 'scan.json'),
      '--profile', profileSnapshot,
      '--root', dir, '--out', out,
    ], { encoding: 'utf8' });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /UX-102 suppressed for spacing — 2 distinct values, not a scale \(12 literals\)/);
    assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')).suppressed, scan.suppressed);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
