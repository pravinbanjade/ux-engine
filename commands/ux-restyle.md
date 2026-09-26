---
name: ux-restyle
description: Repair UI in this repo against its recorded design system — substituting off-system literals for tokens and proposing the repairs that need judgment. Edits code only after you approve the plan.
---

Use the `ux-engine:restyle-ui` skill to repair the repository at the current working
directory.

Scope: if `$ARGUMENTS` names a path, restyle that path — pass it to the
scanner as `--path <path>` and to the report as `--scope path --path <path>`.
Otherwise restyle the whole repo with `--scope path`.

Always run `restyle.mjs --dry-run` first and present the plan. Apply only
after the user approves.
