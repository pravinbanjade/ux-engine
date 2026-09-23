---
id: UX-035
title: The headline figure is rendered at body size
category: visual-hierarchy
severity: medium
detection: model
appliesTo: [stat-tile, dashboard, detail-view]
---
## Signal
The value the tile or screen exists to communicate — the total, the balance,
the count, the percentage — is rendered at the same size and weight as its own
caption and the prose around it. Frequently the label is the more prominent of
the two, set in a heavier weight than the figure it describes.

## Why it fails
A stat tile is read in under a second or not at all; users scan a dashboard
for numbers and stop when one looks wrong. Setting the figure at body size
removes the only reason the tile exists, so the user reads the label to find
the number, then reads the number, on every tile, every time. A wall of such
tiles is slower to scan than a table would have been.

## Fix
Render the value at the top of the profile's type scale, several steps above
the body, and demote its caption to the smallest label treatment in a muted
colour. Keep units and deltas subordinate to the figure so the number is what
the eye lands on first and the rest qualifies it.

## Counter-example — when this is fine
A dense figure table where many values sit side by side and none is the
headline — a financial statement, a comparison grid. Enlarging one would claim
an importance the data does not have.
