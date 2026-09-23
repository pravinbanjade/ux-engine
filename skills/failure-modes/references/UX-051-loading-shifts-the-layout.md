---
id: UX-051
title: The loading state is shaped nothing like the content that replaces it
category: state-coverage
severity: medium
detection: model
appliesTo: [list, card, table]
---
## Signal
The pending branch renders something structurally unlike the resolved branch —
a small centred spinner in the space a full table will occupy, a single line
where a grid of cards will land, or nothing at all until data arrives. The
container has no reserved height, so its size is determined entirely by
whichever branch is rendering.

## Why it fails
When the content arrives it displaces everything below it, often while the
user has already started reading or is reaching for a control. A click aimed
at a link lands on whatever moved into that position, which on a screen with
destructive row actions is more than an annoyance. Late-arriving sections make
it repeat, so the page settles in a series of jumps.

## Fix
Render the pending state at the shape and size the content will occupy, using
the profile's skeleton or placeholder treatment, with the same row height,
column count and card dimensions as the resolved branch. Where the final size
genuinely varies, reserve a minimum height so arrival adjusts the container
rather than repositioning the page.

## Counter-example — when this is fine
Content loading below the fold, or into a region nothing follows — the last
section of a page, an appended page of results. Nothing is displaced, because
nothing sits underneath to move.
