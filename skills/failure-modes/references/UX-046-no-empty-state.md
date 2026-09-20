---
id: UX-046
title: List or table has no design for zero results
category: state-coverage
severity: high
detection: model
appliesTo: [list, table, dashboard, search-results]
---
## Signal
The component that renders a list, table, or dashboard's item collection has
no conditional branch for a zero-length data set — reading the code or
markup, an empty array falls through to the same container the populated
state uses, rendering a bare header over blank whitespace, or a table with a
header row and no body rows at all.

## Why it fails
A first-time user seeing an empty screen cannot tell whether it's empty
because they haven't done anything yet, because a filter is hiding
everything, or because something broke — the interface gives them no signal
either way, and the natural read of unexplained blankness is "this is
broken," which erodes trust in the product before they've used it once.

## Fix
Give the zero-result case its own explicit render: a short message that
states which of the three causes applies (no data yet vs. filtered to zero
vs. an error — this mode covers the first two; UX-048 covers the error case)
and, where the empty state is reachable by the user's own action, a way out
(create the first item, clear the filter).

## Counter-example — when this is fine
A component that structurally cannot be empty in the product's data model —
a fixed-cardinality settings panel, a table always seeded with system
defaults — where zero rows would indicate corrupted state rather than a
normal lifecycle moment, so a dedicated empty-state design would never
actually render and isn't worth building.
