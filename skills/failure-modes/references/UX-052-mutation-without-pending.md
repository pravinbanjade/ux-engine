---
id: UX-052
title: A change in flight looks exactly like no change at all
category: state-coverage
severity: medium
detection: model
appliesTo: [form-submit, button, table-row-actions]
---
## Signal
The mutation handler awaits its request, and the tree rendered during that
await is identical to the tree rendered before it. The control that triggered
it is unchanged, the row or record being modified carries no pending
treatment, and no busy state is bound anywhere — the only thing that differs
is a variable the user cannot see.

## Why it fails
The user has no way to tell the instruction was received. On a row of items
where several can be changed, they also cannot tell which one is being acted
on, so a slow request looks like a missed click on an unknown target. The
usual response is to press again, or to press the same action on a second row
believing the first did not take, and now two changes are in flight where one
was intended.

## Fix
Render the in-flight state on the element the change will affect — the row,
the card, the record — using the profile's pending treatment, and put the
triggering control in its busy variant at the same time. Keeping both marked
tells the user that the instruction landed and which object it landed on.

## Counter-example — when this is fine
A change applied optimistically and shown immediately, where the interface has
already moved to the new value and reconciles or rolls back on the response.
The user sees their change; there is no gap to fill.
