---
id: UX-082
title: Clipped text with no way to reach the rest of it
category: data-display
severity: medium
detection: model
appliesTo: [table, card, list]
---
## Signal
Text is cut off by a fixed width or a line clamp, and nothing on the screen
recovers the remainder: no tooltip carrying the full value, no expansion in
place, no detail view holding it. The clipped string and the complete one are
indistinguishable except where an ellipsis happens to appear.

## Why it fails
The truncated tail is often where the distinguishing information lives — two
records whose names differ only after the cut are identical on screen, and a
user selects the wrong one. Where the value is a message, a note or a reason,
the clipping removes exactly the content that was recorded to be read. Users
resort to copying values elsewhere to see them, or widening the browser and
hoping.

## Fix
Pair every truncation with a route to the whole value: expansion in place for
a row the user can open, a tooltip carrying the full text for a short label,
or a link to the record that holds it. Where the value is long-form, truncate
at a boundary that keeps the informative part visible rather than at a fixed
character count.

## Counter-example — when this is fine
A preview whose full content is reached by the obvious next action — the first
line of a message in an inbox, where opening the message is what the user came
to do and the truncation is a summary, not a loss.
