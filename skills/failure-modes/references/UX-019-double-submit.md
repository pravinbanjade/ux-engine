---
id: UX-019
title: Submitting twice sends the request twice
category: interaction
severity: high
detection: model
appliesTo: [form-submit, button]
---
## Signal
The submit handler issues its request without recording that one is in flight
and without disabling the control. No guard flag is read at the top of the
handler, no busy state is bound to the control's disabled property, so a
second activation before the first resolves enters the handler again and
sends a second request.

## Why it fails
The second request usually succeeds, which is the problem: two orders, two
charges, two invitations to the same person. The user caused it by doing the
ordinary thing — pressing again when nothing appeared to happen — and the
damage lands in data rather than on screen, so it is discovered later by
someone else, often after money has moved.

## Fix
Hold the in-flight state in the component and disable the control while it is
set, clearing it on both success and failure so a failed attempt can still be
retried. Where the operation must not repeat even across a reload, carry an
idempotency key with the request so the server can recognise the duplicate.

## Counter-example — when this is fine
An operation that is idempotent by construction — setting a value to a fixed
state, saving a draft that overwrites itself. Sending it twice produces the
same result as sending it once, and blocking the second press only delays a
user who pressed again for good reason.
