---
name: restyle-ui
description: Use when repairing UI that an audit has already flagged — substituting off-system literals for tokens and proposing the repairs no script can make. Writes to source files, and never without approval.
---

# Repairing UI against the recorded design system

This is the only ux-engine command that edits code. Two paths, and they are
not interchangeable:

- **Mechanical.** A scanner finding carries the token its literal should have
  been. A tested script plans the exact splice and applies it. You never type
  the replacement text yourself — if you find yourself hand-editing a literal,
  stop: the script exists so that the same finding is repaired the same way
  every time.
- **Judgment.** A model finding — a missing empty state, an undifferentiated
  hierarchy, a destructive action with the same weight as its neighbour — has
  no mechanical form. You propose it, the user approves it, then you write it.

## Procedure

1. **Check the profile.**
   Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/check-profile.mjs <repo-root>`:
   - **0** — current. Continue.
   - **2** — stale. Offer to re-run `/ux-design-system` first. A restyle
     against a stale profile substitutes yesterday's tokens into today's code;
     if the user declines, say so in your report.
   - **3** — missing or invalid. Stop. Tell the user to run
     `/ux-design-system`.
   - **4** — the profile's schema is newer than this plugin. Stop and tell the
     user to update ux-engine.

2. **Confirm `DESIGN.md` exists.** Absent → stop. Restyling without a recorded
   design system is churn, and the script refuses anyway.

3. **Produce fresh findings.** Run the scanner over the scope to a temp file
   (`node ${CLAUDE_PLUGIN_ROOT}/scripts/scan-off-system.mjs`), then
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/report-findings.mjs` with
   `--out <temp>/findings.json`. **Do not reuse an existing
   `.ux-engine/findings.json`** — a finding's line is only true of the tree it
   was measured against.

4. **Preview.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/restyle.mjs --findings
   <temp>/findings.json --profile <repo-root>/.ux-engine/profile.json --root
   <repo-root> --dry-run`. Present the plan as it is; do not summarise it away.
   If it exits 7, files the plan touches have uncommitted changes — show the
   user and let them commit, stash, or ask for `--allow-dirty`.

5. **Apply.** On approval, run the same command without `--dry-run`. Report
   the verification line it prints. An exit of 6 means a literal survived its
   own substitution: that is a defect in the fixer, so report it rather than
   retrying.

6. **Propose the judgment repairs.** For each finding in the plan's "Needs
   judgment" section, write one entry: the file, what you would change, and
   which mode it answers. Read that mode's file first and honour its
   Counter-example section. Get approval before editing anything.

7. **Verify the judgment edits.** Re-run the audit over the files you touched
   and report which findings cleared. If a finding survives twice, stop and
   surface both the code and the remaining findings to the user. Do not try a
   third time.

## Reading the plan's "Needs a human" list

Each row names the token to use and why the script would not write it:

- `arbitrary-utility-value` — the literal sits inside a utility class's
  arbitrary-value bracket. Rewriting it to a utility name needs a mapping from
  token to utility family that the profile does not record, and guessing the
  family is how a plausible, wrong class name gets written. Hand this to the
  user with the token name.
- `unsupported-context` — the literal is not in a CSS declaration, so
  `var()` is not valid there. Examples: a bare constant, a component prop,
  a colour under a key that is not a colour property (`PRIMARY: '#1890ff'` in
  a constants object passed to a chart), or console `%c` styling.
- `outside-token-package` — the file sits in a different package from the
  token source, such as an API's HTML email template or a CLI's colours.
  `var()` would resolve to nothing there, because the stylesheet declaring the
  token is never loaded. Do not substitute by hand either. Tell the user this
  code has its own palette, and let them decide whether it needs one.
- `non-dom-renderer` — the file imports a renderer that never loads a
  stylesheet, such as a PDF renderer, React Native, a terminal UI or a 3D
  scene. Its style objects look like CSS, but `var()` resolves to nothing
  there. The fix is a JS constant exported beside the tokens, if the user
  wants one, not a CSS variable.
- `moved` — the file changed after the scan. Re-run step 3.
- `no-token` — nothing in the token set is close enough. This is a signal to
  add a token, not to force a match.
- `no-column` — the finding predates positional scanning. Re-run step 3.

## What not to do

- Do not hand-edit a mechanical substitution. The script's whole purpose is
  that the same finding is repaired identically every time.
- Do not apply anything before the user has seen the plan.
- Do not repair a finding the Deliberate Exceptions section covers — it was
  dropped before the plan was built, and re-adding it defeats the section.
- Do not treat a suppressed mode as a pass. A suppression means the design
  system is too thin for that mode's advice; the remedy is more tokens, not a
  quieter report.
