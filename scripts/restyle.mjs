#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateProfile } from './lib/profile.mjs';
import { ENVELOPE_VERSION } from './lib/findings.mjs';
import { scanRepo } from './lib/scanner.mjs';
import { planSubstitutions, applyEdits, renderPlan } from './lib/restyle.mjs';
import { themeValues } from './lib/tokens.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const USAGE = 'Usage: restyle.mjs --findings <json> --profile <path> [--root <dir>] [--design <path>] [--dry-run] [--allow-dirty] [--adopt-theme] [--json]';

const findingsPath = flag('findings');
const profilePath = flag('profile');
if (!findingsPath || !profilePath) {
  console.error(USAGE);
  process.exit(1);
}

const root = resolve(flag('root', '.'));
const designPath = resolve(flag('design', join(root, 'DESIGN.md')));

// 1. Profile — same vocabulary and exit code as every other command.
let profile;
try {
  profile = JSON.parse(readFileSync(resolve(profilePath), 'utf8'));
} catch {
  console.error('No usable profile at that path. Run /ux-design-system first.');
  process.exit(3);
}
const defect = validateProfile(profile);
if (defect) {
  console.error(`${defect} Run /ux-design-system first.`);
  process.exit(3);
}

// 2. Repair without a recorded target system is churn, not repair.
if (!existsSync(designPath)) {
  console.error('No DESIGN.md. Run /ux-design-system first — restyling without a recorded design system is churn.');
  process.exit(5);
}

// 3. Envelope.
let envelope;
try {
  envelope = JSON.parse(readFileSync(resolve(findingsPath), 'utf8'));
} catch {
  console.error('Could not read --findings JSON.');
  process.exit(4);
}
if (!envelope || typeof envelope !== 'object' || !Array.isArray(envelope.findings)) {
  console.error('Findings file is not an envelope: expected an object with a findings array.');
  process.exit(4);
}
if (Number(envelope.version) > ENVELOPE_VERSION) {
  console.error(`Findings file is version ${envelope.version}, newer than this plugin understands (${ENVELOPE_VERSION}). Update ux-engine.`);
  process.exit(4);
}

// 4. Plan first: it writes nothing, and the working-tree check below needs
// to know which files are actually in play.
// What each theme-varying token is in the default theme and elsewhere, read
// from the token files as they are now. A file that cannot be read adds
// nothing, and a token it would have described stays a manual row.
const tokenSource = profile.styling.tokenSource ?? [];
const tokenCss = [];
for (const file of tokenSource) {
  try {
    tokenCss.push(readFileSync(join(root, file), 'utf8'));
  } catch {
    // Reported by check-profile as a stale source; nothing to add here.
  }
}
const plan = planSubstitutions(envelope, {
  root,
  tokenSource,
  colorTokens: profile.tokens?.color ?? null,
  themedTokens: profile.styling.themedTokens ?? [],
  themeValues: themeValues(tokenCss),
  adoptTheme: has('adopt-theme'),
});

// 5. The review mechanism after a restyle is `git diff`, and it is worthless
// mixed with unrelated work. Outside a git repo there is nothing to protect,
// so the check is skipped rather than made into a refusal.
if (!has('allow-dirty') && plan.edits.length) {
  const files = [...new Set(plan.edits.map((e) => e.file))];
  const status = spawnSync('git', ['-C', root, 'status', '--porcelain', '--', ...files], { encoding: 'utf8' });
  if (status.status === 0 && status.stdout.trim()) {
    console.error('These files have uncommitted changes; commit or stash them so the restyle is reviewable on its own:');
    for (const line of status.stdout.trimEnd().split('\n')) console.error(`  ${line.trim()}`);
    console.error('Pass --allow-dirty to restyle anyway.');
    process.exit(7);
  }
}

// 6. Preview.
process.stdout.write(has('json') ? `${JSON.stringify(plan, null, 2)}\n` : `${renderPlan(plan)}\n`);
if (has('dry-run')) process.exit(0);

// 7. Apply.
const summary = applyEdits(plan.edits, { root });
for (const failure of summary.failed) {
  console.error(`Could not write ${failure.file}: ${failure.reason}`);
}
process.stdout.write(`\nApplied ${summary.applied} substitution(s) across ${summary.files.length} file(s).\n`);

// 8. Verify. A fixer that reports success while leaving the literal in place
// is worse than one that fails, so the claim is measured, not assumed.
if (summary.applied) {
  // Keyed on file|line|value, not column: a fresh scan of the rewritten
  // file reports different columns, so a column-keyed set would never
  // match anything and the check would pass vacuously.
  const applied = new Set(
    plan.edits
      .filter((e) => summary.files.some((f) => f.file === e.file))
      .map((e) => `${e.file}|${e.line}|${e.value}`),
  );
  const { findings } = scanRepo(root, profile, {});
  const remaining = findings.filter((f) => applied.has(`${f.file}|${f.line}|${f.value}`));
  if (remaining.length) {
    console.error(`Verification failed: ${remaining.length} substituted literal(s) are still present out of ${summary.applied} applied.`);
    for (const f of remaining.slice(0, 10)) console.error(`  ${f.file}:${f.line} ${f.value}`);
    process.exit(6);
  }
  process.stdout.write(`Verified: all ${summary.applied} substituted literal(s) are gone from a fresh scan.\n`);
}
