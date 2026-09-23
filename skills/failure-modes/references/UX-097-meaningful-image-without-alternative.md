---
id: UX-097
title: A graphic carries information and has no text alternative
category: accessibility
severity: high
detection: model
appliesTo: [icon-button, card, status-indicator]
---
## Signal
An image or glyph conveys something available nowhere else on the screen — a
status, a category, a rating, a warning — and is rendered with an empty text
alternative or none at all. There is no adjacent text restating what the
graphic says, so removing the graphic would remove the information.

## Why it fails
For anyone not seeing the graphic, the information is simply gone, and its
absence is silent: nothing announces that something was skipped. A row whose
only indication of failure is a red glyph reads as a normal row. Users make
decisions from what they were told, and they were told less than everyone else
without being warned of it.

## Fix
Give the graphic a text alternative stating the information it carries — the
status in words, the category by name — rather than describing the picture.
Where the same information already appears in adjacent text, mark the graphic
as decorative with an empty alternative instead, so it is not announced twice.

## Counter-example — when this is fine
A glyph that only reinforces text already beside it — a warning triangle next
to the word "Warning", an icon beside its own label. The empty alternative is
correct there, because announcing it would repeat what was just read.
