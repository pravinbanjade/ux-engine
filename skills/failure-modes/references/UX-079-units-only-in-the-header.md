---
id: UX-079
title: The unit appears once in the header and never on the values
category: data-display
severity: medium
detection: model
appliesTo: [table, stat-tile, detail-view]
---
## Signal
A column header or card title names the unit — hours, megabytes, a currency —
and every value beneath it is a bare number. On a table long enough to scroll,
the header leaves the viewport while the values remain; in exports, dense
views and copied cells, the header does not travel with the data at all.

## Why it fails
A number without its unit is not a fact. A user who scrolls, copies a value
into a message, or reads a row in isolation has a figure they cannot
interpret, and the most common way to interpret it is to assume the unit they
expected — which is how a figure in thousands gets acted on as a figure in
units. Nothing on screen corrects the assumption.

## Fix
Attach the unit to the value itself where the values are few or the surface is
dense, and where repetition would crowd the column, pin the header so it stays
visible while the rows scroll. Carry the unit into exported and copied output
either way, since that is where the header is guaranteed to be lost.

## Counter-example — when this is fine
A surface where every figure shares one unit stated prominently and
unmistakably — a currency-specific report whose title names the currency and
which holds no other kind of number.
