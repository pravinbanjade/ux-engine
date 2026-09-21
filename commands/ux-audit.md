---
name: ux-audit
description: Audit existing UI in this repo against its recorded design system and report findings ranked by severity. Read-only; never edits code.
---

Use the `ux-audit` skill to audit the repository at the current working
directory.

Scope: if `$ARGUMENTS` names a path, audit that path — pass it to the scanner
as `--path <path>` and to the report as `--scope path --path <path>`.
Otherwise audit the whole repo with `--scope path`.

Do not pass `--fail-on`: an audit reports, it does not gate.
