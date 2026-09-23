---
id: UX-036
title: Every group wrapped in its own bordered container
category: visual-hierarchy
severity: low
detection: model
appliesTo: [card, page, dashboard]
---
## Signal
Each grouping on the screen is enclosed in a container carrying a border, a
shadow or a raised background — including groups nested two and three deep
inside other such containers. The markup reads as boxes inside boxes, and the
border treatment is identical at every level.

## Why it fails
A border says "this is a separate surface". When every group says it, none
does: the user sees a grid of frames and still has to read the contents to
learn what groups with what. Nested frames are worse, implying a depth
relationship the content does not have, and each one consumes padding, so the
screen holds less while looking more crowded.

## Fix
Group with spacing drawn from the profile's scale — wide gaps between groups,
tight ones within — and reserve borders and elevation for surfaces that truly
sit on another plane, such as an overlay or a panel that scrolls
independently. Where a boundary is genuinely needed inside a group, use a
single rule rather than a full enclosure.

## Counter-example — when this is fine
A canvas of independently draggable or rearrangeable units — a widget board, a
card wall — where each unit really is its own surface and the border is what
communicates that it can be picked up and moved.
