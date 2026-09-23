---
id: UX-024
title: Content advances on a timer the user cannot stop
category: interaction
severity: medium
detection: model
appliesTo: [toast, card, page]
---
## Signal
A timer advances or dismisses content — a rotating banner, a notification that
disappears after a few seconds, a carousel stepping on an interval — and there
is no control that halts it. The interval is cleared only on unmount, so
whether the content can be read at all is decided by how fast the user reads.

## Why it fails
Reading speeds differ by more than the margin these timers allow. Anyone
reading in a second language, using a screen magnifier, or simply interrupted
mid-sentence loses the content, and there is no way to get it back — a
dismissed notification is usually gone for good, along with whatever it was
reporting. Motion beside text also makes the text harder to read for anyone
whose attention it pulls.

## Fix
Give the user a control that stops the timer and keeps it stopped until they
restart it, and halt the timer automatically while the pointer or focus is
within the content. Where the content carries something the user must act on —
an error, a result, a value they need — drop the timer and require a dismissal.

## Counter-example — when this is fine
A brief acknowledgement of something the user just did, whose message is
recoverable elsewhere: a save confirmation that fades, where the saved state
is visible in the record itself. Missing it costs nothing, because the fact it
reported is still on screen.
