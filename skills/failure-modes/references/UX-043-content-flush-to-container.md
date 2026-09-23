---
id: UX-043
title: Content sits flush against the edge of its container
category: visual-hierarchy
severity: low
detection: model
appliesTo: [page, card, form]
---
## Signal
A container — a card, a panel, a page shell — renders its children with no
inset from its own boundary. Text starts at the border, controls touch the
edge, and on a bordered surface the rule appears to underline the first and
last lines. Nothing in the styles applies the profile's container padding.

## Why it fails
The inset is what tells the eye where one surface ends and the next begins.
Without it the boundary and the content merge, so a bordered card reads as a
box drawn around text rather than as a distinct surface, and adjacent
containers appear to run together. On a small viewport the content also
collides with the screen edge, where rounded display corners and gesture areas
can physically clip it.

## Fix
Apply the profile's container padding token on every surface that holds
content, using the same step for all four sides unless the profile defines an
asymmetric one, and keep the page shell's outer gutter at least as wide. Where
a child must reach the edge, such as a full-bleed image or a table that
scrolls, let that one child opt out rather than removing the container's inset.

## Counter-example — when this is fine
A surface whose content is deliberately edge-to-edge — a media thumbnail
filling its card, a map, a chart that uses its own internal margins. Adding an
inset there would frame something designed to fill.
