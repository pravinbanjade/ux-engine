---
id: UX-068
title: Validation errors are summarised at the top and nowhere else
category: forms
severity: medium
detection: model
appliesTo: [form, field, form-footer]
---
## Signal
A rejected submission renders its failures as a list above the form, while the
fields that caused them are unchanged — no error treatment, no message
attached to the input, no indication of which control each summary entry
refers to beyond the field name in its text.

## Why it fails
The user has to translate names into positions, scrolling a long form to find
each one, and field names in messages rarely match the visible labels exactly.
On a form long enough to need scrolling, the summary leaves the viewport as
soon as they go looking, so they scroll back to re-read which error they were
fixing. Fixing three errors means making that trip three times.

## Fix
Attach each failure to the field that produced it, using the profile's field
error treatment and message placement, so the error is visible where the
correction happens. Where a summary is also wanted for the count and for
assistive technology, make each entry a link that moves focus to its field.

## Counter-example — when this is fine
A failure that belongs to the submission rather than to any field — a server
rejection, a rule spanning several values. It has no field to attach to, and
the summary is the honest place for it.
