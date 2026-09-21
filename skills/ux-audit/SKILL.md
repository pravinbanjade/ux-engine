---
name: ux-audit
description: Use when reviewing existing UI against this repo's recorded design system — either a path (/ux-audit) or the working diff (/ux-review). Reports findings; never edits code.
---

# Auditing UI against the recorded design system

Read-only. You find and report; you do not fix. Both `/ux-audit` and
`/ux-review` run this procedure and differ only in scope.

The mechanical parts — scanning literals, applying exceptions, scoping to a
diff, ranking, rendering — belong to scripts. Your job is the part a script
cannot do: deciding whether a component actually exhibits a failure mode.

## Procedure

1. **Check the profile.**
   Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/check-profile.mjs <repo-root>`:
   - **0** — current. Continue.
   - **2** — stale. Show the user which sources changed and offer to re-run
     `/ux-design-system` before continuing. If they decline, continue and say
     in the report that the profile was stale.
   - **3** — missing or invalid. Stop. Tell the user to run
     `/ux-design-system`. Do not guess at a design system.
   - **4** — the profile's schema is newer than this plugin. Stop and tell the
     user to update ux-engine.

2. **Scan.**
   Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/scan-off-system.mjs --profile
   <repo-root>/.ux-engine/profile.json --root <repo-root>` (add `--path <dir>`
   when auditing one directory) and save stdout to a temp file.

3. **Read the index only.**
   Read `${CLAUDE_PLUGIN_ROOT}/skills/failure-modes/references/INDEX.md`. It is
   one line per mode: ID, category, severity, detection, title. Do not read
   mode files yet.

4. **Select candidates.**
   List the files in scope and what each one is: a table, a form, a list, a
   detail view, a dialog. Pick the modes whose category and `appliesTo` match
   what you are actually looking at — a form pulls forms and state-coverage
   modes, a data table pulls data-display and information-architecture. Skip
   `detection: scanner` modes; the scanner already reported those. Skip
   `detection: conformance` modes too — they compare code against an approved
   wireframe, which only the generation command has.

5. **Read only the selected mode files, then judge.**
   For each candidate mode, read its file and check the code against its
   Signal section. Honour the Counter-example section: a mode that names the
   situation you are looking at as fine is not a finding. Cite what you saw,
   not what you assume.

6. **Write your findings as JSON.**
   One array, each row `{ "id": "UX-NNN", "file": "<repo-relative path>",
   "line": <1-based number or null>, "evidence": "<what in the code shows
   this>", "message": "<one sentence>" }`. Do not set `severity` or
   `category` — they come from the mode file, and a value that disagrees with
   it is rejected. Write it to a temp file.

7. **Report.**
   Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/report-findings.mjs --scanner
   <scan.json> --model <model.json> --profile <repo-root>/.ux-engine/profile.json
   --design <repo-root>/DESIGN.md --root <repo-root>` plus the scope flags the
   command gives you. Present its output as it is; do not re-rank or re-word
   it. If it exits 4, your findings JSON was malformed — read the errors, fix
   the rows it named, and run it again.

## What not to do

- Do not edit any file. Repair is `/ux-restyle`'s job.
- Do not re-derive the report from the scanner output by hand; the ranking,
  deduplication and exception handling live in the script for a reason.
- Do not report a finding the Deliberate Exceptions section already covers —
  the script drops those, and re-adding them in prose defeats the section.
- Do not invent a mode ID. Every finding cites an ID that exists in the index.
