---
id: UX-102
title: Hard-coded spacing value bypasses the spacing scale
category: system-consistency
severity: medium
detection: scanner
appliesTo: [any]
---
## Signal
A margin, padding, or gap declaration uses a numeric literal (`13px`,
`0.85rem`) that does not match any value in the project's spacing token
group, whether written directly in a style declaration or produced by an
inline utility escape hatch that accepts an arbitrary value, rather than a
spacing token or a utility class generated from the scale. The scanner flags
values that fall outside the declared spacing step set with no tolerance for
near-misses.

## Why it fails
Spacing consistency is what makes a UI feel like one coherent system instead
of a set of independently eyeballed screens — a handful of off-scale values
scattered through the codebase reintroduce the "this screen feels slightly
different" effect that a spacing scale exists to eliminate, and each one
makes the next off-scale value look more normal by precedent.

## Fix
Snap the value to the nearest step in the existing spacing scale (the
`spacing` token group, extracted from `styling.tokenSource`) rather than
tuning a bespoke number — if the layout genuinely needs a gap the scale
doesn't offer, that's a signal to add a new step to the scale itself, not to
special-case one component around it.

## Counter-example — when this is fine
A value that isn't really "spacing" in the design-system sense at all — a
1px hairline border width, an icon's internal SVG viewBox padding, or a
negative-margin hack compensating for a third-party widget's own fixed
padding that the codebase doesn't control. The spacing scale governs layout
rhythm between the product's own elements, not incidental pixel math.
