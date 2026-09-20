---
id: UX-032
title: Identical spacing between related and unrelated elements
category: visual-hierarchy
severity: medium
detection: model
appliesTo: [form, list, card]
---
## Signal
The gap between a label and its own field equals the gap between that field
and the next field's label, and equals the gap between the whole group and
the next group — every spacing value on the screen is the same token, so
grouping is only legible from the content itself, not the layout.

## Why it fails
Proximity is how layout communicates "these belong together" without
requiring the user to read every label. When all spacing is uniform, that
channel is switched off, and the user has to read labels one by one to
reconstruct groupings a glance should have given them — slower on every
visit, and actively confusing on a long form where mis-grouping a field
changes its meaning.

## Fix
Use at least two spacing steps from the token scale: the smaller one between
elements that belong together (label to its field), the larger one between
groups (one field's group to the next). This is a relationship to encode, not
a specific pixel value — pull both steps from the existing spacing scale
rather than inventing new numbers.

## Counter-example — when this is fine
A single flat list of independent, unrelated items — a settings list of
one-off toggles with no sub-grouping, a feed of chronological log entries —
where every item genuinely is its own unit and uniform spacing correctly
communicates that there's no grouping to signal. Introducing uneven spacing
there would fabricate a relationship that doesn't exist.
