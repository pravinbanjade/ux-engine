---
id: UX-092
title: Colour is the only signal distinguishing meaning
category: accessibility
severity: high
detection: model
appliesTo: [badge, chart, status-indicator, field]
---
## Signal
Two or more states, categories, or validity conditions are distinguished
only by hue — a red vs. green status dot with identical shape and no text,
a chart whose series are separated only by line color with no distinct
markers or dash patterns, a field whose error state is only a red border with
no icon or message change.

## Why it fails
Roughly 1 in 12 men and a smaller share of women have some form of color
vision deficiency that makes red/green or similar hue pairs hard to tell
apart, and colour is invisible entirely on a monochrome print, a low-quality
screenshot, or to anyone using a grayscale display mode — for all of them,
a colour-only signal is no signal.

## Fix
Pair colour with a second channel: an icon or shape difference (check vs. x)
alongside status colour, a text label alongside a colour-coded badge, a
distinct line style or marker shape alongside a chart series colour. Pull the
colour itself from the existing token groups rather than introducing new
hard-coded hex values.

## Counter-example — when this is fine
A colour used purely as decoration or brand accent with no meaning attached
to it at all — a gradient background, an accent stripe — where nothing is
actually being communicated by the colour choice, so there's no distinction
for a colourblind or grayscale viewer to lose. This mode applies only where
colour is carrying information a user needs to act on.
