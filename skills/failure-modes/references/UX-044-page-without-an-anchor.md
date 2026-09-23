---
id: UX-044
title: The screen opens straight into content with no header block
category: visual-hierarchy
severity: low
detection: model
appliesTo: [page, page-header]
---
## Signal
The first rendered element inside the screen's main region is content or a
control — a table's header row, a filter bar, the first form field. There is
no header block: no title band, no place where the screen's name and its
primary action sit together at the top edge.

## Why it fails
The eye needs somewhere to start, and a screen that begins mid-content makes
every visit begin with a small orientation cost. The primary action has
nowhere consistent to live either, so it ends up wherever the layout had room
— different on each screen — and users hunt for it. Across a product built
this way, no two screens open the same way.

## Fix
Open every screen with a header block holding its name and its primary action,
built from the profile's page-header pattern, and separate it from the content
with a step from the spacing scale. Keeping the block's position identical
across screens is what turns it into a landmark rather than another element.

## Counter-example — when this is fine
A screen embedded inside another surface that already provides the header — a
panel within a workspace, a tab body under a shared title bar. A second header
there repeats what is already above it.
