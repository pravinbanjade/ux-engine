---
id: UX-098
title: The overlay opens without taking, holding or returning focus
category: accessibility
severity: high
detection: model
appliesTo: [modal]
---
## Signal
The overlay mounts and focus stays wherever it was, usually on the control
that opened it, behind the overlay. Nothing constrains focus to the overlay
while it is open, so tabbing walks out into the page underneath, and on close
nothing restores focus to the invoking control.

## Why it fails
A keyboard user is left interacting with a screen they cannot see, behind a
surface that is blocking it. Tabbing appears to do nothing visible while focus
travels through the obscured page, and reaching the overlay's own controls may
require tabbing through the entire document first. On close, focus falls to
the start of the page, so the user's place is lost every time an overlay is
opened and dismissed.

## Fix
Move focus into the overlay when it opens — to its first control, or to the
overlay container where it holds only text — hold focus inside while it is
open by cycling at both ends, and restore it to the invoking control on close.
Bind escape to the same close path so the overlay can be left without a
pointer.

## Counter-example — when this is fine
A non-blocking surface that does not obscure the page and is not meant to
interrupt — an inline popover, a notification stack the user can ignore.
Taking focus there would interrupt the task rather than protect it.
