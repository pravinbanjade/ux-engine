---
id: UX-026
title: Dismissing the overlay discards typed input without asking
category: interaction
severity: high
detection: model
appliesTo: [modal, form]
---
## Signal
The overlay holds a form, and every close path — a backdrop click, the escape
key, the close control — unmounts it directly. No path checks whether the user
has entered anything; the dismissal handler and the cancel handler are the
same function, and neither reads the form's dirty state.

## Why it fails
A backdrop click is the easiest accident in an interface: a mis-aimed click, a
stray tap, a keystroke intended for the field. When it costs ten minutes of
typing that cannot be recovered, users stop trusting the dialog and start
drafting their text somewhere else first. The loss is silent and total, and
nothing on screen suggested it was possible.

## Fix
Track whether the form is dirty, and when it is, intercept every close path
with a prompt that offers to keep editing or discard. Leave the dismissal
immediate when nothing has been entered, so the guard costs nothing in the
common case, and preserve the entered values behind the prompt so "keep
editing" returns the user exactly where they were.

## Counter-example — when this is fine
An overlay whose input is persisted as it is typed — an autosaving draft, a
filter panel writing straight to the query state. Dismissing loses no work
because nothing was being held only in the dialog.
