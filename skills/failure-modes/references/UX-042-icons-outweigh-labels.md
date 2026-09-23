---
id: UX-042
title: Icons drawn heavier than the labels they annotate
category: visual-hierarchy
severity: low
detection: model
appliesTo: [nav-item, toolbar, button]
---
## Signal
The icon beside a label is rendered at a size and colour that equals or
exceeds the label's optical weight — a full-saturation glyph at or above the
cap height of the text, often in an accent colour while the label sits in the
neutral ramp. Across a navigation list, the glyphs form a column that reads
before any of the words do.

## Why it fails
Users navigate by word, not by picture: the label is what they are looking
for, and the icon is at best a reinforcement. Weighting the glyph higher means
the eye lands on a shape it must then decode, and icon vocabularies are far
less standardised than their designers assume. The result is a navigation list
that takes longer to scan than one with no icons at all.

## Fix
Render icons below the label's optical weight — the profile's smaller icon
size, in a muted neutral — so the glyph annotates rather than competes. Let
the accent colour mark the selected item instead, where it distinguishes one
entry rather than tinting them all.

## Counter-example — when this is fine
A compact icon-only control set where the glyph is the whole affordance and
labels appear on focus or hover — a formatting toolbar, a rail of tools. There
is no label to outweigh.
