---
id: UX-053
title: A completed write produces no visible acknowledgement
category: state-coverage
severity: medium
detection: model
appliesTo: [form-submit, toast, button]
---
## Signal
The request resolves successfully and the branch that runs afterwards renders
no confirmation and updates nothing on screen: no notification, no change to
the displayed record, no navigation. The resolved state and the state before
the user acted are the same rendering, so a success and a quietly swallowed
failure are indistinguishable.

## Why it fails
The user is left to verify the system's work themselves — reloading the
screen, navigating away and back, or opening the record in another tab to
check. Many will simply submit again. And because a failure that was caught
and ignored looks identical, the interface has made its one honest report of
trouble impossible to distinguish from everything going right.

## Fix
Acknowledge the completed write where the user is looking: update the affected
record in place so the new value is visible, and where the change is not
visible on the current screen, render a confirmation using the profile's
notification component naming what was saved. On failure, say so in the same
place rather than leaving the pre-submit rendering intact.

## Counter-example — when this is fine
A write whose result is the screen the user is taken to — a create that
navigates to the new record, a submit that advances a step. The destination is
the acknowledgement.
