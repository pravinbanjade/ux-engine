---
id: UX-102
title: Hard-coded spacing value bypasses the spacing scale
category: system-consistency
severity: medium
detection: scanner
appliesTo: [any]
---
## Signal
A length declaration uses a numeric literal (`13px`, `0.85rem`) that does
not match any value in the token group its context selects, whether written
directly in a style declaration or produced by an inline utility escape
hatch that accepts an arbitrary value. A margin, padding or gap is measured
against the `spacing` group; a width, height or `size-*` against `sizing`,
which holds container and breakpoint tokens rather than rhythm steps. The
scanner flags values that fall outside the declared step set with no
tolerance for near-misses, and reports nothing at all when the context does
not say which group a length belongs to.

## Why it fails
Spacing consistency is what makes a UI feel like one coherent system instead
of a set of independently eyeballed screens — a handful of off-scale values
scattered through the codebase reintroduce the "this screen feels slightly
different" effect that a spacing scale exists to eliminate, and each one
makes the next off-scale value look more normal by precedent.

## Fix
Snap the value to the `nearestToken` the finding names, not to whichever
step looks close — the scanner picked the group from the surrounding code
(`spacing` for a padding, margin or gap; `sizing` for a width or height),
and snapping a container width to a gutter token is what that separation
exists to prevent. If the layout genuinely needs a step the scale doesn't
offer, that's a signal to add one to that scale, not to special-case one
component around it.

## Counter-example — when this is fine
A value that isn't really "spacing" in the design-system sense at all — a
1px hairline border width, an icon's internal SVG viewBox padding, or a
negative-margin hack compensating for a third-party widget's own fixed
padding that the codebase doesn't control. The spacing scale governs layout
rhythm between the product's own elements, not incidental pixel math.
