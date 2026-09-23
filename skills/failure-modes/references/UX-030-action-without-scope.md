---
id: UX-030
title: The action names the verb but not what it acts on
category: interaction
severity: medium
detection: model
appliesTo: [button, table-row-actions, toolbar]
---
## Signal
The control's accessible name is a bare verb — Remove, Send, Approve — and the
surrounding markup does not resolve which object it applies to. The same label
repeats beside every row, or sits in a toolbar above a selection, so the label
alone is identical for a dozen different effects.

## Why it fails
A user who has scrolled, or been interrupted, or arrived by keyboard, cannot
tell what the button will affect until after it has fired. Screen-reader users
hear a list of identical names with nothing to distinguish them. When the
action is destructive, the first unambiguous statement of scope arrives in the
undo message, if there is one.

## Fix
Name the object in the control's accessible name — the record, the count, the
filtered set — even where the visible label stays short for layout reasons.
Where the action opens a confirmation, restate the scope there in the same
words, so the user reads the same object twice before anything happens.

## Counter-example — when this is fine
A control whose object is the whole screen and could not be anything else — a
single Save on a detail view, a Submit at the foot of one form. There the verb
alone is unambiguous, and naming the object restates the page title.
