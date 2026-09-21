---
name: ux-review
description: Review the working diff against this repo's recorded design system before committing, reporting only findings the diff introduced or touched.
---

Use the `ux-audit` skill to review the working diff in the repository at the
current working directory.

Scope: pass `--scope diff` to the report script, with `--base <ref>` if
`$ARGUMENTS` names one; the default base is `HEAD`, which covers staged and
unstaged work together. Add `--fail-on high`, so a high-severity finding
exits non-zero and can gate a commit.

In step 4 of the skill, restrict the files you consider to the ones the diff
touches. Run `git diff --name-only HEAD` (or against the given base) to list
them.
