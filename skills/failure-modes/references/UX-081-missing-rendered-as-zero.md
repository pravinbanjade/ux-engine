---
id: UX-081
title: A value that was never recorded is drawn as zero
category: data-display
severity: high
detection: model
appliesTo: [table, detail-view, stat-tile]
---
## Signal
An absent value reaches the render path without a check and appears as a zero,
an empty cell, or the literal text of whatever the absence was represented by.
Nothing distinguishes it from a measured zero, and where the figure feeds an
aggregate, the absence is summed as though it were a number.

## Why it fails
"Not recorded" and "recorded as none" call for opposite responses: one means
chase the missing data, the other means the thing genuinely did not happen. A
user shown zero acts on the second reading — reports a device as idle that was
merely offline, closes a case that was never measured. Because the rendering
is confident, nothing prompts them to check.

## Fix
Branch on absence before rendering and show a distinct marker that means not
recorded, using the profile's muted placeholder treatment so it reads as an
absence rather than a value. Exclude absent values from aggregates and say how
many were excluded, keeping zero for a measurement that returned zero.

## Counter-example — when this is fine
A domain where absence genuinely means zero and is defined that way — no rows
recorded for a period means no activity occurred. The mapping is part of the
data's meaning, not an accident of rendering.
