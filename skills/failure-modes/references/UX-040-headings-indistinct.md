---
id: UX-040
title: Section headings render identically to the content below them
category: visual-hierarchy
severity: medium
detection: model
appliesTo: [page, detail-view, settings]
---
## Signal
A heading element is rendered at the same size, weight and colour as the prose
or controls beneath it, with no additional space above it. Its only
distinguishing feature is that it comes first — remove the surrounding context
and the heading is indistinguishable from a line of body text.

## Why it fails
Structure is what lets a user skip. A reader looking for one section scans for
headings, and when headings look like content there is nothing to scan, so
they read the screen linearly or give up and use the browser's find. Long
settings and detail screens are where this bites hardest, because those are
precisely the screens nobody reads end to end.

## Fix
Separate headings from their content using the profile's type scale and
spacing: a step up in size or weight, and more space above the heading than
below it, so each heading binds visually to the section it opens. Keep the
same treatment for every heading at that level across the product.

## Counter-example — when this is fine
A run-in heading inside dense reference prose, where the heading is
deliberately part of the paragraph's first line and the surrounding density is
the point — a glossary, a legal clause list.
