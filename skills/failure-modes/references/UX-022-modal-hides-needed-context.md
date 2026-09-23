---
id: UX-022
title: The dialog covers the data its own question depends on
category: interaction
severity: medium
detection: model
appliesTo: [modal, form]
---
## Signal
The overlay asks for input that can only be decided by reading something on
the screen it covers — a quantity that must not exceed a balance shown behind
it, a date that must fall inside a period listed in the table underneath — and
that value appears neither inside the dialog nor in any part of the page the
overlay leaves visible.

## Why it fails
The user has to close the dialog to read the number, memorise it, reopen the
dialog and type it — and the reopening frequently clears what they had already
entered. Where memory fails they guess, and the guess is submitted, so the
error arrives as bad data rather than as a validation message. The overlay has
taken away the only source for the answer it demands.

## Fix
Bring the referenced values into the dialog itself, rendered as read-only
context beside the field that depends on them. Where the dependency is a whole
table rather than a figure or two, move the task out of the overlay and onto
its own surface, where the supporting data stays readable throughout.

## Counter-example — when this is fine
A dialog whose question is self-contained — a confirmation, a rename, a choice
between two named options. Nothing behind it is needed to answer, so covering
the page costs the user nothing.
