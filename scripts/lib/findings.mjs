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
