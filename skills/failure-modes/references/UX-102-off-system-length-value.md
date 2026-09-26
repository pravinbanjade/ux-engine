---
id: UX-102
title: Hard-coded length bypasses its token scale
category: system-consistency
severity: medium
detection: scanner
appliesTo: [any]
---
## Signal
A length declaration uses a numeric literal (`13px`, `0.85rem`) that matches
no value in the token group its context selects, whether written directly in
a style declaration or produced by an inline utility escape hatch that
accepts an arbitrary value. The group comes from the surrounding code, and
there are four: a margin, padding or gap is measured against `spacing`; a
width, height or `size-*` against `sizing`, which holds containers and
breakpoints rather than rhythm steps; a corner against `radius`; a font size,
line height or letter spacing against `type`. The finding names the group it
used. The scanner flags values outside the declared step set with no
tolerance for near-misses, and reports nothing at all when the surrounding
code does not say which group a length belongs to.

## Why it fails
A scale is worth having because it is finite: a reader of the code, and a
person using the product, can tell that two things are the same size because
they are literally the same token. Every literal written past the scale is a
step nobody decided on, and it costs the same in each group — off-scale gaps
are the "this screen feels slightly different" effect a spacing scale exists
to eliminate, off-scale font sizes are a type ramp that no longer ranks
anything, off-scale radii are corners that read as different components, and
off-scale widths are containers that line up on one page and not the next.
Each one also makes the next literal look more normal by precedent, which is
how a scale stops being the thing anyone checks against.

## Fix
Snap the value to the `nearestToken` the finding names. The row says which
scale it measured against, and that is the scale to snap within — a container
width takes a container token, not the gutter step that happens to be closer
in pixels. If the design genuinely needs a step that scale does not offer,
add it to that scale, so the next component has it too, rather than
special-casing this one call site.

A group the report suppressed for holding no usable scale is telling you
something different: there is nothing to snap to yet, and the fix is to
build the scale the suppression's distribution is already sketching.

## Counter-example — when this is fine
A length that is not a design-system quantity at all — a 1px hairline border,
an icon's internal SVG viewBox math, or a negative margin compensating for a
third-party widget's own fixed padding that this codebase does not control.
The scales govern the product's own rhythm, dimensions, corners and type
ramp, not incidental pixel arithmetic that no token would ever express.
