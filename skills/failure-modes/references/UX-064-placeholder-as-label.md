---
id: UX-064
title: The field's only label is its placeholder
category: forms
severity: medium
detection: model
appliesTo: [field, form]
---
## Signal
The input carries a placeholder naming what it collects — "Email address",
"Invoice number" — and no persistent label element bound to it. The name of
the field exists only in the attribute the browser clears the moment a
character is typed.

## Why it fails
The field loses its name exactly when the user most needs it: while filling it
in, and again when reviewing the completed form before submitting. Anyone
interrupted mid-form returns to a column of filled boxes with nothing saying
what each holds, and correcting one field means clearing it to see its name.
Placeholder text is also rendered at low contrast by convention, so it is hard
to read before it disappears.

## Fix
Render a persistent label element bound to the input, positioned per the
profile's field pattern, and let the placeholder carry an example of the
expected value instead of the field's name. The label then survives entry,
review and correction, and gives the input an accessible name that does not
vanish.

## Counter-example — when this is fine
A single-field surface whose purpose is stated immediately beside it — a
search box under a heading that says what is being searched, a one-input
lookup. The name is on screen and stays there; it simply is not on the input.
