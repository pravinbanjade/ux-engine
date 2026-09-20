---
id: UX-103
title: Hard-coded animation duration bypasses the motion tokens
category: system-consistency
severity: low
detection: scanner
appliesTo: [any]
---
## Signal
A transition or animation declares a duration or easing literal (`300ms`,
`0.45s ease-in-out`) instead of referencing a value from the project's motion
token group (values `categorizeToken` buckets as `motion`, such as
`--duration-fast`). The scanner flags any timing value in transition,
animation, or transform-related properties that doesn't match a declared
motion token.

## Why it fails
Inconsistent durations are subtle individually but additive across a
product: one component that snaps in at 100ms next to another that eases in
over 400ms reads as unpolished even when neither number is wrong in
isolation, because the two motions imply two different "weights" to actions
that should feel equivalent. Motion tokens exist so the whole product moves
at a small, deliberate set of speeds instead of an accumulation of
one-off guesses.

## Fix
Replace the literal with the nearest existing duration token for that
motion's weight class (fast for micro-interactions like hover, slower for
larger transitions like a panel opening); if the product's motion scale
doesn't yet have a step for this case, add one to the token source rather
than hard-coding around the gap.

## Counter-example — when this is fine
A duration tied to something outside the design system's control, such as a
value driven by physics-based spring animation parameters (mass/stiffness
rather than a fixed duration), or a duration deliberately matched to an
external constraint like a third-party video's fade length — cases where the
number isn't an arbitrary design choice the token scale is meant to
standardize.
