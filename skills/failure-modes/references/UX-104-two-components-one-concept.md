---
id: UX-104
title: One concept rendered by two components with different affordances
category: system-consistency
severity: medium
detection: model
appliesTo: [any]
---
## Signal
Two components in the repository render the same concept — a record summary, a
status chip, a confirmation prompt — with different markup, different spacing
and different controls, and both are imported on screens the same user visits.
Neither is deprecated, and neither imports the other.

## Why it fails
The user learns the concept twice, and the second version quietly contradicts
the first: an action present in one and absent in the other, a status colour
that means something slightly different. Every fix must then be made in both,
and one of them is always forgotten — which is how the two drift further apart
over time rather than converging.

## Fix
Keep the component that already covers both call sites, extend it with the
variant the other one needed through the mechanism the profile records, and
replace the second at its call sites before deleting it. Leaving both in the
tree behind a preference guarantees the divergence continues.

## Counter-example — when this is fine
Two components that look alike and answer genuinely different questions — a
read-only summary and an editable one, a compact row and an expanded record.
Merging them produces one component with a mode flag and both behaviours
tangled inside it.
