---
name: ux-design
description: Generate new UI against this repo's recorded design system — intent questions, a reviewed wireframe, then code checked against both the failure-mode library and the wireframe you approved.
---

Use the `ux-engine:design-ui` skill to generate UI in the repository at the current
working directory.

`$ARGUMENTS` is the intent: what screen is being built. If it is empty, ask
what screen this is before anything else — there is nothing to derive a slug
from and nothing to anchor the five questions to.

Pass `--scope diff --base HEAD` to the stage-4 report, so the enforcer reports
only what this run wrote.
