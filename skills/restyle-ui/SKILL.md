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

3. **Produce fresh findings.** Make a temp directory, then run:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/scan-off-system.mjs \
     --profile <repo-root>/.ux-engine/profile.json --root <repo-root> \
     [--path <dir>] > <temp>/scan.json
   node ${CLAUDE_PLUGIN_ROOT}/scripts/report-findings.mjs \
     --scanner <temp>/scan.json --profile <repo-root>/.ux-engine/profile.json \
     --root <repo-root> --scope path [--path <dir>] \
     --out <temp>/findings.json --report <temp>/report.md
   ```

   **Do not reuse an existing `.ux-engine/findings.json`** — a finding's line
   is only true of the tree it was measured against.

4. **Preview.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/restyle.mjs --findings
   <temp>/findings.json --profile <repo-root>/.ux-engine/profile.json --root
   <repo-root> --dry-run`. Present the plan as it is; do not summarise it away.
   If it exits 7, files the plan touches have uncommitted changes — show the
   user and let them commit, stash, or ask for `--allow-dirty`.

   Rows the same literal repeats are folded into one, with every position
   listed. Manual rows are grouped by reason.

   **Theme-varying tokens are opt-in.** If the plan says some rows match a
   theme-varying token in the default theme, tell the user how many, and
   offer `--adopt-theme`. Say what it does in their terms: the element looks
   the same in the default theme and follows the token in the others, so a
   hard-coded white card turns dark in dark mode. That is usually the fix,
   but not always. A brand button meant to look the same in every theme
   gets worse. If they accept, run the dry run again with `--adopt-theme`.
   Show the rows marked "other themes", which name each token's value
   there, and get approval for that plan. Never add the flag unless the
   user asks for it.

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

Each row names the token to use and why the script would not write it.

A row marked **(same value)** names a token that holds the literal's own
value. Applying it by hand leaves the page looking the same, and the
reason is only about meaning: a status token, a component's token, a
theme. Any row without the mark changes how the page looks if applied.
Never call a set of manual rows safe, or offer to apply them in bulk,
unless every row in it is marked. For an unmarked row, say what it
changes, such as "`#2c5282` becomes the lighter `--chip-neutral-fg`",
and let the user decide row by row or group by group.

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
- `semantic-token` — the only close token is a state token (`status`,
  `success`, `error` and so on). The colour matches, but using it would claim
  a state the element may not have. Ask whether the element really shows
  that state. If it does not, the design system is missing a neutral token
  for this colour.
- `role-mismatch` — the only close token is meant for a different property,
  such as a text token for a background. Suggest the user add a token for
  this role rather than borrow one.
- `approximate` — the suggested token is close but not the same. The script
  substitutes a colour only when the difference is too small to see (0.01
  in OKLab), and a length or duration only when the token holds exactly the
  same value, so that a restyle never changes how the page looks. `17px`
  beside a 16px token lands here. Show the user both values and let them
  choose. Moving to the token is a design change, not a repair.
- `different-unit` — the token holds the same length in another unit, such
  as `16px` against a `1rem` token. They match only while the root font
  size is 16px, and an `em` depends on the element. Ask the user whether
  the root size is ever changed before applying it by hand.
- `varying-value` — the length token is declared with more than one value,
  for example redefined in a media query or a density class. The literal is
  the same everywhere, so substituting it changes the element wherever the
  token differs. Check those places with the user first.
- `scoped-token` — the only close token was made for a specific component
  or domain, such as `--chip-academic-accent`. Reusing it elsewhere ties this
  element to that component's next redesign.
- `theme-varying` — the token takes different values in different themes,
  but the literal is the same in all of them. Substituting it changes how
  the element looks in the other theme, such as white text going dark in
  light mode. When the literal matches the token's default-theme value, the
  section says how many, and `--adopt-theme` applies them after the user
  agrees (step 4). The rest need a human to check both themes.
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
