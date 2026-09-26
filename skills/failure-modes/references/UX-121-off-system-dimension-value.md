---
id: UX-121
title: Hard-coded width or height bypasses the sizing scale
category: system-consistency
severity: medium
detection: scanner
appliesTo: [any]
---
## Signal
A width, height, or their min/max and logical (`inline-size`, `block-size`)
variants is set to a fixed literal such as `1184px` or `22rem` that matches
no value in the `sizing` token group — the containers, breakpoints and
fixed component dimensions a project declares. The literal may sit in a
style declaration or an arbitrary-value utility class. Percentages, viewport
units and intrinsic keywords are not literals and are never reported.

## Why it fails
Dimensions are how a product lines up across pages. When one page's content
column is 1184px, another's 1200px and a third's 75rem, each looks deliberate
alone and the set looks broken: edges jump as a person navigates, and every
breakpoint has to be tuned per page because no two containers agree on where
they stop. A sizing scale turns "how wide is the content" into one decision,
made once, instead of a guess re-made by whoever builds the next screen.

## Fix
Replace the literal with the `nearestToken` the finding names, which is a
container, breakpoint or component size — never the spacing step that
happens to be numerically closer. When the design needs a dimension the
scale lacks, add a named token for it (`--container-lg`, `--sidebar-width`)
so the next page that needs the same width finds it.

## Counter-example — when this is fine
A dimension dictated from outside the design system: an embedded map or
video player with a vendor-required minimum size, an avatar image whose
pixel size must match the asset served, or a print stylesheet sized to a
physical page. None of these is a product layout decision a token would
make more consistent.
