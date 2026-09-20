---
id: UX-061
title: Field validation only runs at form submit
category: forms
severity: medium
detection: model
appliesTo: [form, field]
---
## Signal
A field with a validation rule (format, required, range) shows no error until
the user clicks the submit button, at which point every invalid field in the
form surfaces its error at once — there's no validation triggered by blur, by
typing, or by leaving the field.

## Why it fails
The user finds out a field was wrong only after they've mentally moved on
from it and committed to submitting — on a long form this means re-scanning
the whole thing to find which of ten fields the single error banner is
actually about, and re-doing work (re-entering a password confirmation, for
instance) that a per-field check would have caught in the moment.

## Fix
Validate on blur for fields the user has already interacted with (don't
validate before they've typed anything — that flags every empty required
field before they've had a chance), and re-validate on change once a field
has been touched and shown an error, so the error clears as soon as they fix
it rather than lingering until the next submit.

## Counter-example — when this is fine
A validation rule that can only be evaluated server-side and would need a
round-trip on every keystroke or blur to check — a uniqueness check against
existing records, an availability check — where running it eagerly would
either spam the backend or introduce visible lag on every field. Deferring
that specific rule to submit (or debouncing it well past blur) is correct;
it just shouldn't be used as a reason to defer every other rule too.
