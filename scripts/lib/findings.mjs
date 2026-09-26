export const ENVELOPE_VERSION = 1;

// The scanner names a literal by its lexical kind; a report has to name it
// the way a person would.
const NOUN = { color: 'colour', length: 'length', time: 'duration' };

// A length is the only kind whose group is in doubt. The scanner picks it
// from the surrounding code — a padding takes `spacing`, a width `sizing`, a
// font size `type` — and the report is the only place that choice can be
// stated, because a scanner row renders this message and never the mode's
// title. Colours and durations have one group each and always did, so the
// clause would repeat itself on every row without removing any ambiguity.
// A row with no group at all is an envelope written before this existed; it
// renders exactly as it used to rather than saying "the undefined scale".
function scale(row) {
  return row.kind === 'length' && row.group ? ` measured against the ${row.group} scale` : '';
}

function scannerMessage(row) {
  const noun = NOUN[row.kind] ?? 'value';
  if (!row.nearestToken) {
    return `Off-system ${noun} \`${row.value}\`${scale(row)} — no near token; likely a genuinely new value.`;
  }
  return `Off-system ${noun} \`${row.value}\`${scale(row)} — nearest token \`${row.nearestToken}\` (distance ${row.distance.toFixed(2)}).`;
}

export function normalizeScannerFindings(scanOutput, modes) {
  return (scanOutput.findings ?? []).map((row) => {
    const mode = modes.get(row.id);
    if (!mode) throw new Error(`Scanner emitted an unknown mode id: ${row.id}`);
    return {
      id: row.id,
      source: 'scanner',
      severity: mode.severity,
      category: mode.category,
      file: row.file,
      line: row.line,
      column: row.column,
      value: row.value,
      kind: row.kind,
      group: row.group ?? null,
      nearestToken: row.nearestToken,
      distance: row.distance,
      message: scannerMessage(row),
    };
  });
}

export function buildEnvelope({
  findings,
  skipped = [],
  suppressed = [],
  profileHash,
  scope,
  exceptionsApplied = 0,
  generatedAt = new Date().toISOString(),
}) {
  return { version: ENVELOPE_VERSION, generatedAt, profileHash, scope, findings, skipped, suppressed, exceptionsApplied };
}
// Model findings arrive as JSON the skill wrote. Everything here exists so
// that a hallucinated mode id, a guessed severity or a missing line never
// reaches a report looking like a measured fact. Bad rows are named, not
// dropped silently.
export function validateModelFindings(rows, modes) {
  if (!Array.isArray(rows)) return { findings: [], errors: ['model findings must be a JSON array'] };

  const findings = [];
  const errors = [];

  for (const [i, row] of rows.entries()) {
    const where = `model finding ${i}`;
    const mode = modes.get(row?.id);
    if (!mode) {
      errors.push(`${where}: unknown mode id "${row?.id}"`);
      continue;
    }
    if (typeof row.file !== 'string' || !row.file.trim()) {
      errors.push(`${where} (${row.id}): file must be a non-empty string`);
      continue;
    }
    const lineOk = row.line === null || row.line === undefined
      || (Number.isInteger(row.line) && row.line > 0);
    if (!lineOk) {
      errors.push(`${where} (${row.id}): line must be a positive integer or null`);
      continue;
    }
    if (typeof row.evidence !== 'string' || !row.evidence.trim()) {
      errors.push(`${where} (${row.id}): evidence must say what in the code shows this`);
      continue;
    }
    if (row.severity && row.severity !== mode.severity) {
      errors.push(`${where} (${row.id}): severity "${row.severity}" contradicts the mode's "${mode.severity}"`);
      continue;
    }
    if (row.category && row.category !== mode.category) {
      errors.push(`${where} (${row.id}): category "${row.category}" contradicts the mode's "${mode.category}"`);
      continue;
    }

    findings.push({
      id: row.id,
      source: 'model',
      severity: mode.severity,
      category: mode.category,
      file: row.file,
      line: row.line ?? null,
      evidence: row.evidence.trim(),
      message: (row.message ?? mode.title).trim(),
    });
  }

  return { findings, errors };
}

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

// Two rows are the same finding when they name the same mode and the same
// exact place. The value matters: one line commonly holds several
// off-system values — `boxShadow: '0 20px 60px -15px rgba(...)'` is four —
// and keying on id|file|line alone silently keeps one of them. The column
// matters for the same reason one step further in: `0 10px 10px -5px`
// holds the *same* value twice, and without the column the fixer repairs
// one of them and leaves the other. Found by the restyle dogfood, where
// post-apply verification caught the survivor.
const key = (f) => `${f.id}|${f.file}|${f.line ?? 'null'}|${f.column ?? 'null'}|${f.value ?? ''}`;
const spot = (f) => `${f.id}|${f.file}|${f.line ?? 'null'}`;

// Scanner first: a collision between a measured literal and a model's
// judgement about the same line is the same defect seen twice, and the
// scanner row is the one carrying nearestToken for /ux-restyle to use.
export function mergeFindings(scannerFindings, modelFindings) {
  // A model row about a mode the scanner already measured at that spot is
  // redundant whatever literal the scanner matched, so it is dropped by
  // place rather than by the key above.
  const measured = new Set(scannerFindings.map(spot));
  const byKey = new Map();
  for (const finding of modelFindings) {
    if (!measured.has(spot(finding))) byKey.set(key(finding), finding);
  }
  for (const finding of scannerFindings) byKey.set(key(finding), finding);
  return [...byKey.values()];
}

export function rankFindings(findings) {
  return [...findings].sort((a, b) => {
    const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severity !== 0) return severity;
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    return (a.line ?? -1) - (b.line ?? -1);
  });
}

const LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

const cite = (finding) => (finding.line === null || finding.line === undefined
  ? `\`${finding.file}\``
  : `\`${finding.file}:${finding.line}\``);

export function renderReport(envelope, modes) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const finding of envelope.findings) counts[finding.severity] += 1;

  const summary = [
    `scope: ${envelope.scope.kind} \`${envelope.scope.value}\``,
    `${counts.high} high · ${counts.medium} medium · ${counts.low} low`,
  ];
  if (envelope.exceptionsApplied) summary.push(`${envelope.exceptionsApplied} exceptions applied`);
  if (envelope.suppressed?.length) summary.push(`${envelope.suppressed.length} suppressed`);
  if (envelope.skipped.length) summary.push(`${envelope.skipped.length} skipped`);

  const out = ['# UX findings', '', summary.join(' · '), ''];

  if (!envelope.findings.length) {
    out.push('No findings.', '');
  }

  for (const severity of ['high', 'medium', 'low']) {
    const group = envelope.findings.filter((x) => x.severity === severity);
    if (!group.length) continue;
    out.push(`## ${LABEL[severity]}`, '');
    for (const finding of group) {
      out.push(`- **${finding.id}** · ${cite(finding)} — ${finding.message}`);
      if (finding.evidence) out.push(`  - Evidence: ${finding.evidence}`);
      const fix = modes.get(finding.id)?.fix;
      if (fix) out.push(`  - Fix: ${fix}`);
    }
    out.push('');
  }

  // A suppression is a fact about the design system, not about a file, so
  // it gets its own section rather than a line per literal. The summary
  // above carries the count; this says which modes and why. The optional
  // chaining matters: an envelope written before this existed has no
  // `suppressed` key, and reading a v1 file must not throw.
  if (envelope.suppressed?.length) {
    out.push('## Suppressed', '');
    for (const s of envelope.suppressed) {
      // An entry written before `reason` existed has none, and it is always an
      // unusable-scale entry — that was the only reason at the time. Defaulting
      // keeps an older findings file readable.
      if (s.reason === 'no-context') {
        // No cause is named: the entry carries a count and nothing else, and
        // the scanner does not record which contexts produced it. Listing
        // likely ones tells a reader whose own literal was suppressed for a
        // different reason that the line is not about them.
        //
        // An entry written before durations could be unmeasured has no
        // `kind`, and it is always a length — that was the only kind then.
        if (s.kind === 'time') {
          out.push(`- ${s.id} suppressed for ${s.count} duration-shaped value(s) outside any transition or animation — most are timeouts, status codes or prose, so none was measured against the motion scale`);
        } else {
          out.push(`- ${s.id} suppressed for ${s.count} length(s) whose surrounding code does not say which token group they belong to — no scale was applied, so no substitution was offered`);
        }
      } else {
        const group = s.groups.join('|');
        out.push(`- ${s.id} suppressed for ${group} — ${s.distinctValues} distinct values, not a scale (${s.count} literals)`);
        // The line above states a fact the reader can do nothing with. These
        // two say what to do about it: here are the values your own code
        // already uses, in order of how often, which is what a scale gets
        // built out of. An entry written before the scanner kept them has no
        // `values` and renders exactly as it always did.
        if (s.values?.length) {
          const shown = s.values.map((v) => `\`${v.value}\` (×${v.count})`).join(', ');
          const hidden = (s.distinctLiterals ?? s.values.length) - s.values.length;
          out.push(`  - Most used: ${shown}${hidden > 0 ? ` — ${hidden} more not shown` : ''}`);
          out.push(`  - These are the raw material for a ${group} scale; the remedy is tokens, not a quieter report.`);
        }
        // A sizing group can read as empty because its tokens are named in a
        // way the classifier does not recognise as dimensions. These are the
        // spacing tokens filed there on their value alone — the only
        // candidates — and renaming one is what moves it.
        if (s.unclaimedTokens?.length) {
          const names = s.unclaimedTokens.map((n) => `\`${n}\``).join(', ');
          out.push(`  - Filed under spacing by value alone, not by name: ${names} — if any is a container, breakpoint or fixed dimension, name it with container, breakpoint, width, height, size or layout so it lands in sizing.`);
        }
      }
    }
    out.push('');
  }

  if (envelope.skipped.length) {
    out.push('## Skipped', '');
    for (const s of envelope.skipped) out.push(`- \`${s.file}\` — ${s.reason}`);
    out.push('');
  }

  return out.join('\n');
}
