---
id: UX-038
title: Running prose stretched to the full container width
category: visual-hierarchy
severity: low
detection: model
appliesTo: [page, card, detail-view]
---
## Signal
A block of running prose — a description, a help passage, an article body —
is placed in a container with no maximum width, so on a wide viewport its
lines run the full width of the screen, well past a comfortable reading
measure. Nothing in the styles caps the text column; it inherits whatever the
layout gives it.

## Why it fails
Returning from the end of a long line to the start of the next is the
error-prone part of reading, and the longer the line the more often the eye
lands on the wrong one. Readers re-read lines, lose their place, or give up
partway. The effect worsens on exactly the large displays that were supposed
to be the better experience.

## Fix
Cap the prose container using the profile's content-width token so lines
settle at a readable measure regardless of viewport, and let the surrounding
layout keep the freed width. Leave tables, charts and data surfaces uncapped —
they are scanned in columns, not read in lines.

## Counter-example — when this is fine
A single short line of text — a caption, a one-sentence summary, a field's
help text — that never wraps at any supported width. There is no line return
to get wrong.
