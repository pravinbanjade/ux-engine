---
id: UX-083
title: The chart form does not match the comparison being made
category: data-display
severity: medium
detection: model
appliesTo: [chart, dashboard]
---
## Signal
The chart's form and its question disagree: parts of a whole drawn as a
sequence, a movement over time drawn as unordered categories, a ranking drawn
in a form with no ordering, or a dozen series rendered in a form that
distinguishes two or three. The data is correct and the shape is answering
something else.

## Why it fails
A chart's whole value is that it answers a question faster than a table does.
The wrong form reverses that — the reader must decode the encoding first, and
often decodes it wrongly, since a sequence implies progression and categories
imply comparability whether or not the data supports either. A dozen
overlapping series are usually read as one indistinct mass and skipped.

## Fix
Choose the form from the question the screen is asking: proportion, change
over time, ranking, distribution or relationship each have forms that render
them directly. Where the surface is asking several questions at once, split
them into separate charts rather than overloading one, and where the series
count exceeds what the form distinguishes, aggregate the tail.

## Counter-example — when this is fine
A form chosen for continuity with something the audience already reads daily —
a house convention in a regularly circulated report — where switching would
cost more in re-learning than the mismatch costs in decoding.
