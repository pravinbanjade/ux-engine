---
id: UX-076
title: Numeric columns rendered in a proportional (non-tabular) numeral style
category: data-display
severity: low
detection: model
appliesTo: [table, stat-tile, list]
---
## Signal
A column or stacked list of numbers (prices, quantities, IDs) uses the
font's default proportional numerals, where digits have different widths, so
the same number of digits in different rows lands at different horizontal
positions and the decimal points or digit columns don't line up vertically.

## Why it fails
Comparing numbers in a column is a vertical scan — the user is looking for
which value is bigger, whether totals match, where the outlier is — and that
scan depends on digits lining up. Proportional numerals turn a glance into a
character-by-character read for every comparison, which is slow exactly
where the table's job is to make comparison fast.

## Fix
Apply tabular (fixed-width) numeral formatting to any numeric column meant
for vertical comparison — most system and web fonts expose this via a
font-feature setting (`font-variant-numeric: tabular-nums` or the
CSS/OpenType equivalent) rather than a different font, so it costs a single
style rule pulled from the existing type tokens, not a typeface change.

## Counter-example — when this is fine
A number that appears once, inline in a sentence or a single stat tile with
nothing else to compare it against — "42 results," a single large KPI
number — where there's no adjacent value the reader is lining digits up
against, so tabular spacing has no comparison to serve and proportional
numerals read more naturally in running text.
