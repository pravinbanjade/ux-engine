---
name: design-system
description: Use when a repo needs its design system detected and recorded — before any other ux-engine command runs, or when DESIGN.md and .ux-engine/profile.json are missing or stale.
---

# Detecting and recording a design system

Produces two artifacts the rest of ux-engine depends on:
`.ux-engine/profile.json` (machine-readable) and `DESIGN.md` (human-readable).

Detection is deterministic and lives in scripts. Your job is to run them in
the right order, resolve what they could not, and explain the result.

## Procedure

1. **Check for existing artifacts.**
   Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/check-profile.mjs <repo-root>` and
   act on its exit code:
   - **0** — a current profile exists. Ask whether to re-detect. Re-detection
     is safe either way: it refreshes every field except the ones listed in
     the profile's `resolvedByHuman` array, which are carried forward
     unchanged. If the user declines anyway, skip straight to step 5 and
     (re)write `DESIGN.md` from the profile that is already there.
   - **2** — stale. The script prints which source files changed since the
     profile was generated. Continue to step 2 to refresh it — this, too, is
     safe: `detect-profile.mjs` re-derives every `resolvedByHuman` field from
     the current profile before it overwrites anything, so a stale source
     file changing never undoes a human's answer.
   - **3** — no usable profile. This covers both "the file is absent" and
     "the file exists but is not a valid profile" (unparseable JSON, not a
     JSON object, a missing or non-numeric `version`, or a `derivedFrom` that
     isn't an array of `{path, sha256}` entries). Both cases mean the same
     thing: continue to step 2 and detect from scratch.
   - **4** — the profile's schema version is newer than this copy of the
     plugin understands. Stop and tell the user to update ux-engine before
     continuing; do not attempt to detect or write anything.

2. **Detect.**
   Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/detect-profile.mjs <repo-root>`.
   It writes `.ux-engine/profile.json` and prints which top-level fields
   (`styling`, `components`, `conventions`) came back low-confidence. This
   must run before step 5 — writing `DESIGN.md` reads this file and refuses
   to run without it.

3. **Resolve low-confidence fields — ask, never guess.**
   For each field the script reported as low, ask the user one question, then
   write the answer into `.ux-engine/profile.json` by hand — see
   `references/detection.md` for the question to ask per field — **and add
   that field's dotted path to the profile's `resolvedByHuman` array** (create
   the array if it doesn't exist yet, e.g. `["components.variantMechanism"]`).
   That array is what makes "asked once, never asked again" actually true:
   every future run of `detect-profile.mjs` reads it back and carries the
   answer forward instead of overwriting it with a fresh guess.

4. **Sanity-check what was detected.**
   Read the profile. If `tokens` is empty but the repo plainly has colours and
   spacing in its components, the automatic extraction missed the real
   stylesheet(s) — find them and correct `styling.tokenSource` to the right
   array of paths (a project can split its tokens across more than one file).
   Add `"styling.tokenSource"` to `resolvedByHuman` the same way step 3 does.
   You can now safely re-run `detect-profile.mjs` afterward: it re-extracts
   `tokens` from the corrected file(s) itself, so you no longer need to
   transcribe values by hand unless the tokens genuinely live outside CSS
   (a JS/TS object) — in that case, still write `tokens` by hand and add
   `"tokens"` to `resolvedByHuman` too.

5. **Write DESIGN.md.**
   Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/write-design-doc.mjs <repo-root>`.
   This requires `.ux-engine/profile.json` to already exist — it exits 3 and
   does nothing if it does not, which is why step 2 must come first.
   Every hand-written `## ` section already in `DESIGN.md` — Deliberate
   Exceptions plus any other section a person added — is carried over
   verbatim. The Tokens, Components and Conventions sections are always
   rebuilt from the fresh profile, so do not hand-edit content under those
   three headings expecting it to survive; put hand-written notes under
   Deliberate Exceptions or a section of your own instead.

6. **Decide whether the profile is committed.**
   Default: commit it, so the whole team shares one reading of the system. Offer
   to gitignore `.ux-engine/` instead if the user prefers per-machine
   regeneration.

7. **Report.** Name the styling system, the component directory, the token
   count by group, and anything you had to ask about. If a group came back
   with fewer than three distinct values, say so here — that is the group
   every length check will suppress.

## When a group is too thin to be a scale

An audit reports this as a suppression, and the report now lists the values
the codebase already uses under it:

```
- UX-102 suppressed for spacing — 2 distinct values, not a scale (321 literals)
  - Most used: `24px` (×22), `1rem` (×18), `8px` (×9) — 16 more not shown
```

That list is evidence, not a scale. Read it and propose one; do not write one
the code does not support, and do not present your proposal as something the
tool measured.

- **Look for the base.** If most values are multiples of one number, say so
  and build the scale from it. If they are not, say that instead — a
  codebase with 19 unrelated spacing values does not have an implicit scale
  waiting to be named, and pretending otherwise produces a scale nobody's
  code matches.
- **Mixed units are a finding of their own.** `16px` and `1rem` appear as
  separate rows because they are written separately. Raise it; do not
  silently normalise.
- **The user decides.** Propose the scale, show which of their existing
  values fall on it and which do not, and let them choose. Adding tokens
  changes every future audit of the repo, so it is not yours to apply.

## Re-running on a repo that already has DESIGN.md

Running step 5 again is safe — hand-written sections are preserved
automatically, so you are not risking a silent loss of anyone's notes. What
changes silently is the generated content: Tokens, Components and
Conventions are rebuilt from the current profile every time. Before you call
the run done, show the user what changed in those sections (diff the new
`DESIGN.md` against the previous committed version) so a detection change —
a new token, a renamed component directory — doesn't slip past unnoticed.
