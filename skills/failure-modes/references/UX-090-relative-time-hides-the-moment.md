---
id: UX-090
title: Only the elapsed interval is shown where the exact moment matters
category: data-display
severity: medium
detection: model
appliesTo: [table, list, detail-view]
---
## Signal
A timestamp the task depends on knowing precisely — an audit entry, a
transaction, a deadline, an incident — is rendered only as an elapsed
interval: "3 days ago", "last month". The underlying value carries full
precision and the exact moment appears nowhere on the surface, not as
secondary text and not on hover.

## Why it fails
Elapsed intervals are coarse and they drift. "Last month" spans thirty-one
possible days, and the same record reads differently tomorrow, so two people
comparing notes describe one event with two different labels. Where the task
is establishing a sequence — which change came first, whether an action fell
inside a window — the rounded form cannot answer, and the answer was in the
data all along.

## Fix
Render the exact moment where the task needs it, with the timezone it is
expressed in, and keep the relative form as secondary text for the at-a-glance
reading. Where space forbids both, show the exact value and make the relative
one the annotation, since precision cannot be recovered from rounding but
rounding can always be recomputed.

## Counter-example — when this is fine
A feed or activity surface where recency is the only question being asked —
whether something happened just now or a while back — and no task on the
screen depends on ordering two entries or checking a boundary.
