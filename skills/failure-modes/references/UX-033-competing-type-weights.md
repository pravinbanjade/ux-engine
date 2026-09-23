---
id: UX-033
title: Four or more type treatments with no dominant one
category: visual-hierarchy
severity: medium
detection: model
appliesTo: [page, card, detail-view]
---
## Signal
One screen renders four or more distinct combinations of size and weight —
a semibold medium, a bold small, a medium large, a regular large — and none
is meaningfully larger than the others. The spread between the biggest and the
smallest is a step or two on the scale, so every block claims a comparable
share of attention.

## Why it fails
The eye resolves a screen by finding the largest thing first and working
outward. With four near-equal treatments there is no largest thing, so the
first glance returns nothing and the user falls back to reading in document
order — which is slower on every visit and defeats the purpose of having a
type scale at all. Screens like this feel busy without anyone being able to
say which part is doing it.

## Fix
Reduce to three levels drawn from the profile's type scale: one dominant, one
supporting, one body. Let position and spacing carry the distinctions the
surplus weights were making, so the removed levels do not take their
information with them.

## Counter-example — when this is fine
A reference or documentation surface with genuinely nested structure —
several heading depths, code, captions, callouts — where each treatment maps
to a distinct semantic level and the nesting is what the reader is navigating.
