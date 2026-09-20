---
id: UX-031
title: No single element reads as the entry point
category: visual-hierarchy
severity: medium
detection: model
appliesTo: [page, card, dashboard]
---
## Signal
Three or more elements on the same screen share the largest type size, the
same heavy weight, or the same high-emphasis button variant, with no other
signal (position, color, size step) separating them — a reader's eye has
nowhere obvious to land first. Common on dashboards where every card header
is styled identically and every card's primary metric is the same size.

## Why it fails
Hierarchy is how a screen tells a scanning user where to start; without one,
the user must read everything to figure out what matters, which is exactly
the work hierarchy exists to avoid. On a dashboard this usually means the one
number the user opened the page to check gets the same five seconds of
attention as everything else, or less.

## Fix
Pick one element per screen (or one per section, for a dashboard of
independent cards) to carry the largest size or heaviest weight in that
region, and step every sibling down at least one size or weight from the
token scale. If several elements are genuinely co-equal, that's a sign the
screen needs sectioning (headers, dividers, grouping) rather than a single
flat rank order.

## Counter-example — when this is fine
A grid of genuinely equal-priority items where sameness is the correct
message — a gallery of product cards, a set of filter chips, a list of
identical notification rows — where no single item should dominate because
the user's job is comparing peers, not finding a starting point. Flagging
uniform weight there would be asking the design to invent a false hierarchy.
