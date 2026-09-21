import { execFileSync } from 'node:child_process';

// `git diff --unified=0 <base>` against the working tree already includes
// staged work, so one invocation covers "everything not yet committed" —
// the state /ux-review cares about. --no-color and --no-ext-diff stop a
// user's own git config from reshaping output we parse.
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

export function changedRanges({ base = 'HEAD', cwd = process.cwd() } = {}) {
  const out = execFileSync(
    'git',
    ['diff', '--unified=0', '--no-color', '--no-ext-diff', '--find-renames', base],
    { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

  const files = [];
  let current = null;

  for (const line of out.split('\n')) {
    if (line.startsWith('+++ ')) {
      const path = line.slice(4).trim();
      // /dev/null on the new side means the file was deleted: its findings
      // no longer exist, so it contributes nothing to scope.
      current = path === '/dev/null' ? null : { file: path.replace(/^b\//, ''), ranges: [] };
      if (current) files.push(current);
      continue;
    }
    if (!current) continue;
    const hunk = HUNK.exec(line);
    if (!hunk) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    // count 0 is a pure deletion: nothing was added, and `start` is the
    // line the removed text sat *after*. Record it as a zero-width point
    // so the margin still surfaces violations left behind next to it.
    current.ranges.push(count === 0 ? { start, end: start } : { start, end: start + count - 1 });
  }

  // `git diff` never lists an untracked file, so a file that was just created
  // has no hunks and would fall out of scope entirely. That is exactly the
  // case /ux-design produces: it writes a new screen and then asks for a
  // report scoped to the diff. A new file is changed from its first line to
  // its last, and Infinity says so without reading every untracked file in
  // the tree just to learn where each one ends. `--exclude-standard` honours
  // .gitignore, so build output stays out. A staged new file is already in
  // the diff above and is not an "other", so nothing is counted twice.
  const untracked = execFileSync(
    'git',
    ['ls-files', '--others', '--exclude-standard', '-z'],
    { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\0')
    .filter(Boolean);
  for (const file of untracked) {
    files.push({ file, ranges: [{ start: 1, end: Infinity }] });
  }

  return files.filter((f) => f.ranges.length > 0);
}

export function inScope(finding, changed, margin = 3) {
  const entry = changed.find((c) => c.file === finding.file);
  if (!entry) return false;
  if (finding.line === null || finding.line === undefined) return true;
  return entry.ranges.some((r) => finding.line >= r.start - margin && finding.line <= r.end + margin);
}
