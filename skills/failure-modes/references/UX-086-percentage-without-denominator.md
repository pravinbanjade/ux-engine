---
id: UX-086
title: A proportion shown with neither its count nor its total
category: data-display
severity: medium
detection: model
appliesTo: [stat-tile, table, chart]
---
## Signal
A percentage, rate or share is rendered alone. The numerator and the
denominator it was computed from exist in the data reaching the component and
appear nowhere on screen — no count beside the figure, no total in the label,
no indication of the sample the proportion describes.

## Why it fails
A percentage without its denominator cannot be weighed. Two out of three
failures renders as sixty-seven per cent and reads like a population
statistic; so does two thousand out of three thousand, and they warrant
entirely different responses. Small samples produce dramatic swings that look
like real movement, and users escalate on figures that rest on a handful of
records.

## Fix
Render the numerator and denominator alongside the proportion, in the
profile's secondary text treatment so the percentage stays the headline. Where
the denominator falls below a threshold at which the figure is not meaningful,
say so in place of the percentage rather than showing a number that will be
over-read.

## Counter-example — when this is fine
A proportion over a denominator that is fixed, known and stated elsewhere on
the surface — a progress figure against a total the screen already shows, a
share of a budget named in the heading above it.
