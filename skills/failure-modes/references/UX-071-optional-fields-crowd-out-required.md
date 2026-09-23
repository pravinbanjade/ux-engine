---
id: UX-071
title: Optional fields outnumber and surround the required ones
category: forms
severity: low
detection: model
appliesTo: [form, field]
---
## Signal
Most of the form's fields are optional, they are interleaved among the
required ones with no grouping, and reaching the submit control means
scrolling past all of them. Nothing distinguishes the shortest valid path
through the form from its full extent.

## Why it fails
Length is what people judge a form by before starting it, and this one looks
like all of its fields. Users fill optional fields because they appear to be
part of the task, spending time on data nobody asked for, or they abandon the
form on sight. Either way the required fields — the ones the product actually
needs — are competing with everything else for the same attention.

## Fix
Move the optional fields into their own group after the required ones,
collapsed behind a control that names what it holds, so the visible form is
the shortest path to a valid submission. Mark the remaining fields' optionality
consistently rather than marking only one of the two states.

## Counter-example — when this is fine
A profile or settings form where completeness is the user's goal rather than
submission — they came to fill things in, and hiding the fields would hide the
point of the screen.
