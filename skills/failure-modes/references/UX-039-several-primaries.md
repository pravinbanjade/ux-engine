---
id: UX-039
title: Two or more controls claim the primary variant in one view
category: visual-hierarchy
severity: medium
detection: model
appliesTo: [button-group, form-footer, toolbar]
---
## Signal
More than one control in a single view is rendered with the profile's primary
button variant — a filled Save beside a filled Publish, or a primary action in
the header and another at the foot of the same form. The view proposes two
next steps with equal visual force.

## Why it fails
The primary variant is a recommendation, and a screen that recommends two
things has recommended neither. The user stops to choose between them, which
is precisely the work the emphasis was supposed to save, and in a
save-versus-publish pairing the wrong choice has consequences. Users who move
fast learn to click the leftmost filled button, which makes the design's
intent irrelevant.

## Fix
Keep one primary per view — the action the screen exists for — and render the
rest with the profile's secondary and tertiary variants, ordered so the
primary sits where this codebase consistently places it. Where two actions
genuinely tie, that is a sign the screen is doing two jobs and should be split.

## Counter-example — when this is fine
A deliberate either-or choice with no default, where recommending one would be
wrong — picking a plan, choosing between two migration paths. Equal weight is
the honest rendering of an equal decision.
