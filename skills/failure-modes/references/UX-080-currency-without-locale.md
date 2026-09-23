---
id: UX-080
title: Money assembled by string concatenation
category: data-display
severity: medium
detection: model
appliesTo: [table, stat-tile, detail-view]
---
## Signal
Monetary values reach the screen through raw number output or manual string
building — a symbol prepended, a fixed decimal count applied by rounding, no
grouping separators. The platform's locale-aware number formatting is not
used, so digits run together in long values and the separator convention is
whatever the code hardcoded.

## Why it fails
Large amounts become unreadable without grouping: a seven-digit figure has to
be counted digit by digit to be understood, and readers routinely misjudge it
by a factor of ten. Worse, decimal and grouping conventions are inverted
between locales, so a hardcoded format is actively misread by part of the
audience — a figure meaning one thousand in one convention means one point
something in another.

## Fix
Format money through the platform's locale-aware number formatting with the
currency named, letting it supply the symbol, the grouping separators and the
correct number of decimal places for that currency. Keep the underlying value
in minor units so the formatter, not arithmetic in the view, decides the
rounding.

## Counter-example — when this is fine
A value being rendered for machine consumption — an export column another
system parses, a field copied into an integration. There the canonical
unformatted form is what the consumer needs.
