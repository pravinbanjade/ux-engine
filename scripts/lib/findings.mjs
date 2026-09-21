export const ENVELOPE_VERSION = 1;

// The scanner names a literal by its lexical kind; a report has to name it
// the way a person would.
const NOUN = { color: 'colour', length: 'length', time: 'duration' };

function scannerMessage(row) {
  const noun = NOUN[row.kind] ?? 'value';
  if (!row.nearestToken) {
    return `Off-system ${noun} \`${row.value}\` — no near token; likely a genuinely new value.`;
  }
  return `Off-system ${noun} \`${row.value}\` — nearest token \`${row.nearestToken}\` (distance ${row.distance.toFixed(2)}).`;
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
      value: row.value,
      kind: row.kind,
      nearestToken: row.nearestToken,
      distance: row.distance,
      message: scannerMessage(row),
    };
  });
}

export function buildEnvelope({
  findings,
  skipped = [],
  profileHash,
  scope,
  exceptionsApplied = 0,
  generatedAt = new Date().toISOString(),
}) {
  return { version: ENVELOPE_VERSION, generatedAt, profileHash, scope, findings, skipped, exceptionsApplied };
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
