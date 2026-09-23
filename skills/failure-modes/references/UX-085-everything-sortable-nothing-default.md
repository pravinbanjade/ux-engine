---
id: UX-085
title: Every column sortable, no column sorted
category: data-display
severity: low
detection: model
appliesTo: [table]
---
## Signal
A sort control is attached to every column, including ones whose values are
near-constant or whose ordering carries no meaning, while the table's initial
order is whatever the source returned — no column is marked as the active
sort, and nothing indicates what the current order represents.

## Why it fails
The first thing a user must do is impose an order, on every visit, because the
one they arrived at means nothing. Rows appear to move between visits as the
source's order changes, which reads as data changing. Meanwhile the sort
controls on meaningless columns are tried once, produce a reshuffle that
answers nothing, and teach the user that the controls are not worth using.

## Fix
Set a default sort matching how the table is actually read — most recent
first, highest value first, alphabetical where the user looks things up by
name — and mark it as active so the current order is legible. Offer sorting
only on the columns the table is meaningfully ordered by, and drop it from the
rest.

## Counter-example — when this is fine
A table whose order is itself the data — a ranked list, a sequence of events,
a priority queue. Re-sorting would discard the meaning, and a default sort
indicator would label something that is not a choice.
