---
id: UX-009
title: One task requires two screens that do not mention each other
category: information-architecture
severity: medium
detection: model
appliesTo: [page, detail-view, form]
---
## Signal
Finishing one thing the user would describe as a single task requires visiting
two screens — create the record here, then grant it access there; add the
member on one route, set their permissions on another. Neither screen links to
the other, and neither states that a further step exists. The first screen's
success message reads as though the task is complete.

## Why it fails
The user believes they are done, because the interface told them so. The
second half goes undone until something breaks — a record nobody can open, a
member who cannot sign in — and the failure surfaces far from its cause, often
to a different person. Every such split also generates support load that looks
like a bug report and is really a missing link.

## Fix
Join the halves. Either carry the second step into the same flow as a
subsequent stage, or have the first screen state plainly what remains and link
straight to where it is done. Where the second step is optional, say so and
name what is lost by skipping it, so the choice is the user's rather than an
accident of navigation.

## Counter-example — when this is fine
Two steps performed by different people with different permissions — one
person requests, another approves. There the split is the point, and what the
first screen owes the user is the status of the pending half, not a link to a
screen they cannot open.
