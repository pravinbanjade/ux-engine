---
name: audit-ui
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

   In a monorepo, a scan with no `--path` covers only the package that holds
   the UI (`profile.components.package`). The report says so in its summary.
   Add `--all-packages` only when the user asks to audit the whole
   repository, server code included.

3. **Name the surfaces.**
   List the files in scope and say what each one is, in the catalog's own
   vocabulary: `table`, `form`, `list`, `detail-view`, `modal`, `chart`,
   `stat-tile`, `settings`, and so on. The full vocabulary is `APPLIES_TO` in
   `${CLAUDE_PLUGIN_ROOT}/scripts/lib/library.mjs`. This is the judgment call;
   the next step is mechanical.

4. **Select candidates.**
   Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/select-modes.mjs --kinds
   <the kinds you just named> --exclude-detection scanner,conformance
   --signals`.

   It prints each candidate mode's index line, file path and Signal. A
   folder with several kinds of surface commonly selects most of the catalog,
   so this is the screening pass: one call instead of a file per mode. The two
   exclusions are not optional: `scanner` modes were already reported in step
   2, and `conformance` modes compare code against an approved wireframe,
   which only the generation command has — selecting one here would mean
   either inventing a wireframe or reporting nothing.

   If the command exits 2, you named a surface kind that is not in the
   vocabulary. Fix the spelling and run it again; do not fall back to reading
   the index, which holds 123 lines and would cost more context than the audit
   has to spare.

5. **Screen by Signal, then read only the modes that survive.**
   Check the code against each candidate's Signal. Most will plainly not
   apply, because nothing in the code has that shape. Drop those without
   opening their files. For each mode whose Signal you can point to in a
   specific file and line, read its full file before reporting. Honour the
   Counter-example section: a mode that names the situation you are looking
   at as fine is not a finding. Cite what you saw, not what you assume.

   Do not open every candidate's file to be thorough. The Signal is the
   whole test for whether a mode applies. The rest of the file tells you
   whether a match is really a finding and what to say about it.

   Read each source file in scope once. Most of an audit's cost is reading
   the code, not the modes. If the scope is large enough to delegate, split
   it by file: give each subagent its own files plus the full Signal list,
   and have it return findings JSON. Do not split by mode category. That
   makes every subagent read every file, and on a 28-page folder it read the
   code four times over. Do not read files yourself that you have handed to
   a subagent, and do not use a separate pass just to name surfaces.
   Whoever reads a file names its kinds in the same pass.

   If the scope holds more than about 15 source files, tell the user how
   many before judging and offer to narrow it. An audit of a whole folder
   is a long, expensive run, and a narrower path is often what they
   wanted.

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
   command gives you. If it exits 4, your findings JSON was malformed — read
   the errors, fix the rows it named, and run it again.

   The script writes the full report to `<repo-root>/.ux-engine/report.md`
   as well as printing it. Present it without re-ranking or re-wording:
   - **20 findings or fewer:** show the report as printed.
   - **More than 20:** show the summary line, then every High row exactly as
     printed, then one line per Medium and Low mode with its count. End
     with the path to `report.md` for the rest.

   An excerpt quotes rows. It never paraphrases them, merges them, or
   replaces a row with your own description of it.

## What not to do

- Do not edit any file. Repair is `/ux-restyle`'s job.
- Do not re-derive the report from the scanner output by hand; the ranking,
  deduplication and exception handling live in the script for a reason.
- Do not report a finding the Deliberate Exceptions section already covers —
  the script drops those, and re-adding them in prose defeats the section.
- Do not invent a mode ID. Every finding cites an ID that exists in the index.
