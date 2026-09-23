---
id: UX-065
title: The control does not match the data it collects
category: forms
severity: medium
detection: model
appliesTo: [field, select, form]
---
## Signal
A free text input collects something with a known shape — a date, a quantity,
a value drawn from a fixed set of options — and the expected format is
conveyed by prose beside the field or by a validation message after the fact.
The fixed option set exists in the code, as an enum or a constant, and is not
offered as a choice.

## Why it fails
The user is asked to produce a format from memory, and formats collide: a date
typed one way is read another, a value typed with a currency symbol is
rejected, an option spelled slightly differently fails to match. Each of those
becomes a validation round trip. On a touch device the wrong control also
means the wrong keyboard, so entering a number costs a keyboard switch on
every field.

## Fix
Use the control the data implies — a date control for dates, a numeric input
for quantities, a select or a set of options where the values are fixed — so
the platform supplies the right keyboard, the right picker and the first layer
of validation. Keep the prose for the constraints the control cannot express.

## Counter-example — when this is fine
An expert entry surface where typing is faster than picking and the users know
the format cold — a date field in a high-volume back-office tool where the
operator enters hundreds a day and a picker would slow every one of them.
