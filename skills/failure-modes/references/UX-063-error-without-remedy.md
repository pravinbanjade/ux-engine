---
id: UX-063
title: Error message states the problem but not the fix
category: forms
severity: medium
detection: model
appliesTo: [field, form-footer, toast]
---
## Signal
A validation or submission error reads as a bare restatement of what's wrong
— "Invalid input," "Something went wrong," "This field is required" on a
field whose requirement isn't obvious from its label — with no accompanying
detail on what value would be accepted or what step resolves it.

## Why it fails
Naming the failure without naming the fix leaves the user to guess-and-check
against a form that already rejected their first guess. On a field with a
specific expected shape (a phone number format, a password policy, a date
range) this can take several failed attempts before the user stumbles onto
what the system actually wanted, all of which reads to them as the product
being unhelpful rather than broken.

## Fix
State the expected shape or the corrective action in the error itself:
"Enter a date after 2024-01-01," not "Invalid date"; "Password needs 8+
characters and one number," not "Password too weak." Where the rule is
complex enough to need real estate, show it as helper text near the field
before the user errs, not only after.

## Counter-example — when this is fine
A generic network or server failure where the system genuinely doesn't know
the specific cause to hand back — a timeout, a 500 from a downstream
service — and the honest remedy is just "try again" or "contact support if
this continues." Inventing a specific-sounding fix for a failure whose cause
is actually unknown would be misleading rather than helpful.
