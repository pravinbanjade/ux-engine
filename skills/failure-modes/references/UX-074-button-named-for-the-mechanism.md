---
id: UX-074
title: The submit control is labelled for the transport, not the outcome
category: forms
severity: low
detection: model
appliesTo: [form-submit, form-footer]
---
## Signal
The control that commits the form carries a label that would be equally true
of every form in the product — a bare verb describing the transmission rather
than the result. Nothing in the label names what will exist, change or be sent
once it is pressed.

## Why it fails
The button is the last thing the user reads before committing, and it is the
one place the interface can state the consequence. A generic label forfeits
that, which matters most where the consequence is significant: a user cannot
tell from the control whether they are saving a draft, publishing to
customers, or charging a card. On a screen with two such controls, the labels
cannot distinguish them at all.

## Fix
Label the control with the outcome it produces, in the user's words, so the
button reads as the thing about to happen. Keep the same phrasing in any
confirmation that follows, so the two agree and the user reads one sentence
rather than two different descriptions of the same act.

## Counter-example — when this is fine
A form whose outcome is fully stated by its surroundings and has exactly one
possible result — a single-purpose dialog whose title names the action and
whose one control confirms it.
