---
id: UX-045
title: Several emphasis devices stacked on one element
category: visual-hierarchy
severity: low
detection: model
appliesTo: [page, badge, card]
---
## Signal
A single element combines uppercase letterforms, a bold weight, an accent
colour and a filled background at once — a badge, a callout, a section label
carrying every device the system has, where the profile uses one of them for
this level of emphasis elsewhere.

## Why it fails
Emphasis is relative, so stacking devices on one element raises the floor for
everything near it: the next thing that genuinely needs attention has nothing
left to escalate to. Uppercase also costs reading speed, since the word shape
that lets readers recognise a word at a glance is flattened, and combining it
with a filled background usually pushes contrast either too low or into an
uncomfortable vibration.

## Fix
Pick the one device the profile already uses for this level — usually weight
or colour, rarely both — and drop the rest, keeping the element's meaning in
its words. Where the element still does not stand out enough, lower the
emphasis of what surrounds it rather than adding a fourth device to it.

## Counter-example — when this is fine
A single deliberate high-alarm element on a screen that otherwise holds none —
a destructive confirmation's warning band, a production-environment marker —
where the stacking is the point and nothing nearby is competing with it.
