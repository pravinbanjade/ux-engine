---
id: UX-066
title: The field's requirements appear only after they are broken
category: forms
severity: medium
detection: model
appliesTo: [field, form]
---
## Signal
Format, length or range requirements exist in the validation logic — a
minimum, a pattern, an allowed character set — and appear nowhere in the
rendered field. The user meets them for the first time as an error message,
after entering a value and attempting to proceed.

## Why it fails
The user has been asked to guess a rule that was known all along, and they
guess wrong in the ways the rule forbids. Each attempt costs a submission, a
wait and a correction, and on a password or identifier field where several
rules apply at once, satisfying one often violates another, so the user
iterates blind. Errors delivered this way also read as the user's mistake
rather than as information withheld.

## Fix
State the requirement beside the field before anything is typed, in the
profile's helper-text treatment, and keep it visible during entry rather than
replacing it with the error. Where several rules apply, list them and mark
each as it is satisfied, so the user can see what remains.

## Counter-example — when this is fine
A constraint the user cannot violate through the control provided — a maximum
enforced by the input itself, a range the picker cannot exceed. Stating it
would describe a boundary they can never reach.
