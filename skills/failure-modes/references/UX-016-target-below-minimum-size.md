---
id: UX-016
title: Interactive target smaller than the minimum tap/click size
category: interaction
severity: medium
detection: hybrid
appliesTo: [icon-button, table-row-actions, nav-item]
---
## Signal
An icon button, row action, or nav item whose clickable/tappable area
(including padding, not just the visible glyph) measures below roughly 24px
on desktop pointer targets or 44px on touch targets, especially when several
such targets sit adjacent to each other in a dense row or toolbar.

## Why it fails
Below the minimum, the cost of a slightly imprecise pointer or finger isn't a
missed click — it's a wrong click on the neighboring target, which is worse
when neighbors include destructive actions. Users with any motor impairment,
or anyone on a moving train tapping a phone, are pushed out of being able to
use the control reliably at all.

## Fix
Grow the hit area to the platform minimum even when the visible icon stays
small — padding counts, the glyph doesn't have to. Where several small
targets are packed into a table row, add horizontal spacing between them
sized from the layout's existing spacing tokens rather than shrinking padding
to fit more in, and confirm the rendered box (not just the icon's viewBox)
against the platform minimum.

## Counter-example — when this is fine
A dense desktop-only power-user surface (a spreadsheet-like grid, a
professional editing tool) where the target audience explicitly trades touch
accessibility for information density and the product has no touch or mobile
surface at all — the 44px touch minimum doesn't apply, and a smaller,
precise-pointer-only target is a legitimate design choice there.
