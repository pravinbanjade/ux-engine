---
id: UX-102
title: Hard-coded spacing value bypasses the spacing scale
category: system-consistency
severity: medium
detection: scanner
appliesTo: [any]
---
## Signal
A margin, padding, gap or offset (`top`, `inset`, `translate`) is written as
a numeric literal (`13px`, `0.85rem`) that matches no step in the `spacing`
token group, either directly in a style declaration or through an inline
utility escape hatch that accepts an arbitrary value. Widths and heights,
corners and font sizes are measured against their own scales and reported
under their own modes. This mode also owns the suppression for a length whose
surrounding code names no property at all, because such a length was not
measured against anything.

## Why it fails
A spacing scale is worth having because it is finite: two gaps that are
meant to be the same are literally the same token, and a reader can see the
rhythm of a screen from its code. Every literal written past the scale is a
step nobody decided on — the "this screen feels slightly different" effect a
spacing scale exists to eliminate. Each one also makes the next literal look
more normal by precedent, which is how a scale stops being the thing anyone
checks against.

## Fix
Snap the value to the `nearestToken` the finding names. If the layout
genuinely needs a gap the spacing scale does not offer, add the step to the
scale so the next component has it too, rather than special-casing this one
call site.

A spacing group the report suppressed for holding no usable scale is telling
you something different: there is nothing to snap to yet, and the fix is to
build the scale the suppression's distribution is already sketching.

## Counter-example — when this is fine
A length that is not a design-system quantity at all — a negative margin
compensating for a third-party widget's own fixed padding that this codebase
does not control, or an offset that positions an element relative to
something measured at runtime. The scale governs the product's own rhythm,
not incidental pixel arithmetic that no token would ever express.
