---
id: UX-017
title: Only the label is clickable inside a row that reads as one target
category: interaction
severity: medium
detection: model
appliesTo: [list, card, table, nav-item]
---
## Signal
The activation handler is attached to the text element — the title, the name,
the link — while the row or card containing it has none. The container carries
padding, a border and a hover treatment that make it read as a single object,
but most of its visible area is inert: clicking the whitespace beside the
label, or the icon, or the secondary line, does nothing at all.

## Why it fails
The styling has promised a target the handler does not honour. Users aim at
the object they see, which is the card, and a click that lands two characters
past the end of the title silently fails. Nothing indicates why, so the user
clicks again, more carefully, and learns to aim at text — a precision cost
paid on every row, and one that falls hardest on anyone with a tremor or a
trackpad.

## Fix
Move the handler to the element that reads as the target, so the entire row or
card activates, and stop propagation on any nested control — a menu button, a
checkbox, a secondary link — so those keep their own behaviour. Keep the
accessible name on the element that now carries the action.

## Counter-example — when this is fine
A row holding several independent destinations — a title, a tag and an author,
each leading somewhere different. There the container has no single meaning to
activate, and making the whole row clickable would have to pick one of the
three arbitrarily.
