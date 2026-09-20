---
name: ux-design-system
description: Detect this repo's design system and record it as DESIGN.md and .ux-engine/profile.json. Run once per repo before any other ux-engine command.
---

Use the `design-system` skill to detect and record the design system for the
repository at the current working directory.

If the user named a different path in `$ARGUMENTS`, use that as the repo root.

Follow the skill's procedure exactly, in order: check for an existing
profile, detect, resolve any low-confidence fields by asking the user, then
write `DESIGN.md`. The doc-writing step depends on the profile already being
on disk, so do not reorder it ahead of detection. Do not guess at any field
the detection script reports as low-confidence — ask the user, then write
the answer back.
