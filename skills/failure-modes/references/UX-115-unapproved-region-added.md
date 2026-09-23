---
id: UX-115
title: The implementation renders a region the wireframe never contained
category: conformance
severity: medium
detection: conformance
appliesTo: [generated-ui]
---
## Signal
A user-facing region appears in the implemented tree with no corresponding
node anywhere in the wireframe's `layout` — an extra panel, a promotional
band, a second toolbar, a set of controls nobody described. It is not an
expansion of an approved node; it has no counterpart at all.

## Why it fails
Surface added after approval is surface nobody reviewed. It competes with the
approved hierarchy for attention, frequently displacing the primary action
further down, and it carries none of the thinking the rest of the screen got —
no stated audience, no failure case, no place in the ranking. Over several
such additions the screen stops resembling the thing that was agreed, while
the wireframe still claims to describe it.

## Fix
Remove the region, or add it to the wireframe and put the amended artifact
through the review the wireframe exists to gate. Where it was added to solve a
real problem found during implementation, that is a reason to amend and
re-review rather than a reason to keep it unrecorded.

## Counter-example — when this is fine
Structural markup with no user-facing presence — a wrapper introduced for
scrolling, a container needed to position approved children. The `layout` tree
describes regions the user perceives, not every element in the render.
