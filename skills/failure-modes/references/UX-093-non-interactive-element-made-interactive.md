---
id: UX-093
title: A generic container given a click handler and nothing else
category: accessibility
severity: high
detection: hybrid
appliesTo: [button, card, list, table-row-actions]
---
## Signal
A generic container carries a click handler and none of what makes an element
a control: no interactive role, no tab position, no key handler for enter or
space. The styling gives it a pointer cursor and a hover treatment, so it
reads as a button to anyone using a mouse and as inert text to everything else.

## Why it fails
The element is operable by pointer only. Keyboard users cannot reach it, since
nothing puts it in the tab order; screen-reader users cannot find it, since
nothing enumerating the screen's controls will list it. Voice control cannot
address it, because it has no name. The capability simply does not exist for
anyone not using a mouse, and nothing on screen says so.

## Fix
Build the control from the element the platform already provides for it, which
supplies the role, the focus behaviour and the key handling without any of it
being written. Where a generic container genuinely must carry the behaviour,
give it the interactive role, a tab position, an accessible name and key
handlers for both activation keys — all four, since three of them leaves the
control still unreachable.

## Counter-example — when this is fine
A click handler that only augments something already operable by other means —
a container that expands on click while a proper control inside it does the
same thing, where the handler is a convenience for pointer users rather than
the only path.
