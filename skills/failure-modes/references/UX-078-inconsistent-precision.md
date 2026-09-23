---
id: UX-078
title: Figures in one column rendered at whatever precision the source gave
category: data-display
severity: low
detection: model
appliesTo: [table, stat-tile, chart]
---
## Signal
Values in a single column or row of figures carry different numbers of decimal
places — one shows two, the next shows none, a third shows five — because each
is rendered straight from whatever the source produced. The decimal points do
not line up, and neither do the digits above them.

## Why it fails
A column of figures is read by comparing digit positions, and inconsistent
precision destroys that: the eye must parse each number in full rather than
scanning down a place column, and a value with five decimals looks larger than
a neighbour with none regardless of magnitude. Spurious precision also implies
a measurement accuracy the underlying data does not have.

## Fix
Fix the precision per column from what the quantity means — currency to its
minor unit, a rate to the places the measurement supports — and format every
value in the column identically, padding rather than trimming. Align the
figures on the decimal point so the column can be scanned as a column.

## Counter-example — when this is fine
A column holding genuinely different kinds of quantity, such as a key-value
list of mixed measurements. There is no column to align because no two rows
are the same unit.
