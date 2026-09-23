---
id: UX-096
title: The field's label is only positional
category: accessibility
severity: high
detection: model
appliesTo: [field, form, select]
---
## Signal
Text sits beside or above an input and looks like its label, but nothing
connects the two: no binding between the label and the input's identifier, no
accessible name on the input, no wrapping association. The relationship exists
only in the layout.

## Why it fails
A screen reader announces the input with no name, so the user is told there is
a text field and nothing about what it wants. On a form of several fields they
are indistinguishable. The missing association also costs every user the
label's click target — tapping the label does not focus the field, which
matters most on touch, where the label is often the larger target.

## Fix
Bind the label to the input so the association is programmatic rather than
positional, using the identifier the input already carries. Where the design
has no visible label, give the input an accessible name directly rather than
relying on a placeholder, and keep that name matching whatever visible text a
voice-control user would say.

## Counter-example — when this is fine
An input whose accessible name comes from a control that wraps it or from
another element it explicitly references — the association exists, it is
simply not made through a label element.
