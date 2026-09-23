---
id: UX-034
title: Accent colour spent on elements that carry no state
category: visual-hierarchy
severity: medium
detection: model
appliesTo: [page, badge, status-indicator]
---
## Signal
The profile's accent and semantic colours are applied to structure — heading
text, section borders, icons tinted for variety, a coloured rule under a title
— while the elements that genuinely encode state, such as a record's status or
a validation outcome, are rendered in the neutral ramp. The colour in the
markup tracks layout, not meaning.

## Why it fails
Colour is the fastest channel a screen has, and it has been spent on things
that never change. By the time the user reaches the status that does change,
the palette has been devalued: another green on a screen of greens reads as
decoration, so state changes go unnoticed. The screen is colourful and, for
the one question the user came to answer, mute.

## Fix
Reserve the profile's semantic colours for the elements that carry meaning —
status, severity, validation, the selected item — and render decorative
structure in the neutral ramp. Where a surface needs visual interest without
meaning, get it from spacing and type rather than from the semantic palette.

## Counter-example — when this is fine
A marketing or onboarding surface with no state to encode, where colour's job
is atmosphere rather than information. Nothing on the screen changes meaning,
so nothing is being drowned out.
