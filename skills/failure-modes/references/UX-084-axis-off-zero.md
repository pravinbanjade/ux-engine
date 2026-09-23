---
id: UX-084
title: The value axis starts somewhere other than zero, unmarked
category: data-display
severity: high
detection: model
appliesTo: [chart]
---
## Signal
The value axis is configured with a non-zero minimum, or left for the charting
library to choose one from the data range, on a chart whose marks encode
magnitude by length or height. Nothing on the chart indicates the baseline has
moved — no axis break, no annotation, only tick labels a reader must notice
and interpret.

## Why it fails
Length-encoded marks are read as proportions: a bar twice as tall is twice as
much. A truncated axis breaks that contract silently, so a two per cent
difference can be drawn as a doubling and will be believed. This is the
mechanism behind most accidentally misleading charts, and the reader has no
way to detect it except by reading the axis labels carefully, which is
precisely what a chart exists to avoid.

## Fix
Start the axis at zero wherever the marks invite magnitude comparison,
including bars, areas and columns. Where the interesting variation genuinely
sits in a narrow band far from zero, mark the break explicitly on the axis, or
switch to a form that encodes change rather than magnitude, such as plotting
the difference itself.

## Counter-example — when this is fine
A line chart of a quantity whose meaningful range never approaches zero — a
temperature series, a stock index, a pH reading. There zero is not a reference
point the reader compares against, and including it would flatten the signal.
