// The Deliberate Exceptions section of DESIGN.md, parsed. One entry per
// line: `<mode-id or *> | <glob> | <reason>`. Anything that isn't shaped
// like an entry is prose and is ignored; anything that *tries* to be an
// entry and fails becomes a warning, because a typo that silently disables
// nothing — or silently disables everything — is the worst outcome here.

const ID = /^(?:UX-\d{3}|\*)$/;
// Looks like someone meant a mode id but got it wrong: "ux-101", "UX-1",
// "UX-1011". Used only to decide warning-vs-ignore.
const ID_ATTEMPT = /^ux-?\d+$/i;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Zero-dependency glob: `**` crosses separators, `*` and `?` do not.
// `**` is consumed before `*` so the two-star form is never read as two
// single-star forms, which would stop it crossing separators.
export function matchGlob(glob, path) {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      out += '.*';
      i += 1;
      // Swallow the separator after `**` so `src/**/*.tsx` also matches
      // `src/a.tsx` — one pattern covering "here and below", which is what
      // someone writing that glob means. A bare directory path is never a
      // finding's file, so `src/**` matching `src` itself is not a case
      // that needs supporting.
      if (glob[i + 1] === '/') i += 1;
    } else if (c === '*') {
      out += '[^/]*';
    } else if (c === '?') {
      out += '[^/]';
    } else {
      out += escapeRegExp(c);
    }
  }
  return new RegExp(`^${out}$`).test(path);
}

export function parseExceptions(markdown) {
  const entries = [];
  const warnings = [];
  const lines = (markdown ?? '').split('\n');

  for (const [i, raw] of lines.entries()) {
    const line = i + 1;
    const text = raw.trim();
    if (!text || !text.includes('|')) continue;

    const fields = text.split('|').map((f) => f.trim());
    const [id, glob, ...rest] = fields;
    const reason = rest.join('|').trim();

    if (!ID.test(id)) {
      if (ID_ATTEMPT.test(id)) {
        warnings.push(`line ${line}: "${id}" is not a mode id — expected UX-NNN or *`);
      }
      continue; // prose, including the legend line
    }
    if (fields.length < 3 || !glob) {
      warnings.push(`line ${line}: expected "<mode-id or *> | <glob> | <reason>"`);
      continue;
    }
    if (!reason) {
      warnings.push(`line ${line}: missing reason — an exception without one cannot be reviewed`);
      continue;
    }
    entries.push({ id, glob, reason, line });
  }

  return { entries, warnings };
}

export function matchesException(finding, entries) {
  for (const entry of entries) {
    if (entry.id !== '*' && entry.id !== finding.id) continue;
    if (matchGlob(entry.glob, finding.file)) return entry;
  }
  return null;
}
