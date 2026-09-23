---
id: UX-095
title: Heading levels chosen for their size rather than the structure
category: accessibility
severity: medium
detection: model
appliesTo: [page, detail-view, card]
---
## Signal
Heading levels track the desired rendered size rather than the document's
nesting — a level skipped because the next one down looked too big, a top
level used on a card title because it needed weight, several top-level
headings on one screen. The outline the levels describe does not match the
sections a reader would name.

## Why it fails
The heading levels are the screen's table of contents, and screen-reader users
navigate long pages by jumping between them. When levels are chosen for
appearance, that outline describes a structure the page does not have —
sections appear nested inside unrelated ones, and skipped levels read as
missing content. A user navigating by heading ends up somewhere other than
where the outline said they would.

## Fix
Choose the level from the section's actual depth in the structure, with one
top-level heading naming the screen, and set the rendered size separately from
the profile's type scale. Keeping the two decisions apart lets a deeply nested
heading be small and a shallow one be large without either lying about the
outline.

## Counter-example — when this is fine
An independent region with its own document outline embedded in a larger page
— a syndicated article, an isolated widget — where the nesting restarts by
design and assistive technology treats it as a separate section.
