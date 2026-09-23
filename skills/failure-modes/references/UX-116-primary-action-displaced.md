---
id: UX-116
title: The approved primary action is not the dominant one on screen
category: conformance
severity: high
detection: conformance
appliesTo: [generated-ui]
---
## Signal
The control implementing the wireframe's `intent.primaryAction` does not carry
the dominant treatment the `hierarchy` ranking assigns it. Another control
holds the primary variant, or the approved action sits below the fold, inside
an overflow menu, or at the foot of a scrolling region while a secondary
action occupies the header.

## Why it fails
`intent.primaryAction` is the answer to what this screen is for, and the
hierarchy was ranked around it. Displacing it inverts that: users take the
action that looks primary, which is now something the design considered
secondary, and the screen's actual purpose becomes the harder of the two to
reach. Because the wireframe still records the intended answer, the drift is
invisible to anyone reading the artifact rather than the screen.

## Fix
Give the approved primary action the dominant treatment and the position the
ranking assigns it, and demote whatever displaced it to the secondary variant.
Where implementation showed the other action genuinely is primary, change
`intent.primaryAction` and re-rank the hierarchy, so the record matches the
screen rather than contradicting it.

## Counter-example — when this is fine
A state-dependent screen where the primary action is unavailable in the case
being compared — already completed, not yet permitted — and the implementation
correctly promotes the next action while the approved one is absent.
