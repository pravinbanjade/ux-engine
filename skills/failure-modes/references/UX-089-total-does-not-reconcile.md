---
id: UX-089
title: The total is computed over a different set than the rows beneath it
category: data-display
severity: high
detection: model
appliesTo: [table, stat-tile]
---
## Signal
An aggregate is rendered as though it summarised the rows on screen, but comes
from elsewhere — the unfiltered collection, a server-computed figure over the
whole set, or a cached value predating the current filter. Applying a filter
changes the rows and leaves the total unchanged, and nothing in the label says
which set it covers.

## Why it fails
A user who filters a table and reads the total has been told a figure about a
set they are not looking at, in a position that says it describes the one they
are. They will reconcile it by hand, find it does not add up, and conclude the
data is wrong — or, worse, not check, and carry the figure into a report. The
mismatch is invisible precisely when filtering is being used, which is when
totals matter most.

## Fix
Compute the aggregate over the same set the rows come from, recomputing it
when the filter changes. Where a figure genuinely must cover a different set —
a server-side total over data not all loaded — label it with the set it
describes and render it distinctly from any total over the visible rows.

## Counter-example — when this is fine
A deliberate pairing of both figures, each labelled: the filtered subtotal
beside the unfiltered total, where seeing the relationship between them is the
point of the screen.
