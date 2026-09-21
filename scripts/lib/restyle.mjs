import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// A utility class's arbitrary value — bg-[#3b7d4f], p-[17px] — is the one
// context that looks substitutable and is not: turning it into a utility
// name needs a token-to-utility-family mapping no profile records, and
// inferring the family from the token's name is guesswork.
const ARBITRARY_OPEN = /-\[$/;

// Walking left from the literal, a property name followed by a colon, with
// no other declaration punctuation in between. True for a stylesheet rule,
// for the same text inside a template literal, and for a JS style object's
// quoted value — the three places `var()` is legal. A named call argument
// (`f(x: '17px')`) also matches; that is rare enough in JS to accept, and
// the preview gate is where it would be caught.
const DECLARATION_BEFORE = /(?:^|[{;,(])\s*['"`]?[-A-Za-z][-A-Za-z0-9]*['"`]?\s*:\s*[^:;{}]*$/;

export function substitutionFor({ lineText, column, value, token }) {
  const before = lineText.slice(0, column - 1);
  const after = lineText.slice(column - 1 + value.length);

  if (after.startsWith(']') && ARBITRARY_OPEN.test(before)) {
    return { manual: true, reason: 'arbitrary-utility-value' };
  }
  if (!DECLARATION_BEFORE.test(before)) {
    return { manual: true, reason: 'unsupported-context' };
  }
  return { text: `var(${token})` };
}

export function planSubstitutions(envelope, { root }) {
  const edits = [];
  const manual = [];
  const judgment = [];
  // One read per file, however many findings it carries.
  const cache = new Map();

  for (const finding of envelope.findings) {
    if (finding.source !== 'scanner') {
      judgment.push(finding);
      continue;
    }
    if (!finding.nearestToken) {
      manual.push({ ...finding, reason: 'no-token' });
      continue;
    }
    if (!Number.isInteger(finding.column)) {
      manual.push({ ...finding, reason: 'no-column' });
      continue;
    }

    if (!cache.has(finding.file)) {
      try {
        cache.set(finding.file, readFileSync(join(root, finding.file), 'utf8').split('\n'));
      } catch {
        cache.set(finding.file, null);
      }
    }
    const lines = cache.get(finding.file);
    if (lines === null) {
      manual.push({ ...finding, reason: 'unreadable' });
      continue;
    }

    // A findings file is only true of the tree it was generated against.
    // Confirm the literal is still exactly here before planning a splice.
    const lineText = lines[finding.line - 1];
    const at = finding.column - 1;
    if (lineText === undefined || lineText.slice(at, at + finding.value.length) !== finding.value) {
      manual.push({ ...finding, reason: 'moved' });
      continue;
    }

    const result = substitutionFor({
      lineText, column: finding.column, value: finding.value, token: finding.nearestToken,
    });
    if (result.manual) {
      manual.push({ ...finding, reason: result.reason });
      continue;
    }

    edits.push({
      id: finding.id,
      file: finding.file,
      line: finding.line,
      column: finding.column,
      value: finding.value,
      token: finding.nearestToken,
      replacement: result.text,
    });
  }

  return { edits, manual, judgment };
}

export function applyEdits(edits, { root, dryRun = false }) {
  const byFile = new Map();
  for (const edit of edits) {
    if (!byFile.has(edit.file)) byFile.set(edit.file, []);
    byFile.get(edit.file).push(edit);
  }

  const files = [];
  const failed = [];

  for (const [file, list] of byFile) {
    let lines;
    try {
      // split('\n') then join('\n') is lossless, so a file without a
      // trailing newline does not silently acquire one.
      lines = readFileSync(join(root, file), 'utf8').split('\n');
    } catch (error) {
      failed.push({ file, reason: error.code ?? 'read-error' });
      continue;
    }

    // Rightmost first: every column is an offset into the line as it is
    // now, and a replacement is longer than the literal it replaces.
    const ordered = [...list].sort((a, b) => (b.line - a.line) || (b.column - a.column));
    for (const edit of ordered) {
      const i = edit.line - 1;
      const at = edit.column - 1;
      lines[i] = lines[i].slice(0, at) + edit.replacement + lines[i].slice(at + edit.value.length);
    }

    if (!dryRun) {
      try {
        writeFileSync(join(root, file), lines.join('\n'));
      } catch (error) {
        failed.push({ file, reason: error.code ?? 'write-error' });
        continue;
      }
    }
    files.push({ file, edits: list.length });
  }

  return { files, failed, applied: files.reduce((n, f) => n + f.edits, 0) };
}
