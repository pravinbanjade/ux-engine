---
id: UX-119
title: The recorded scale is not the scale the code handles
category: conformance
severity: high
detection: conformance
appliesTo: [generated-ui]
---
## Signal
`intent.scale` names a volume the implementation does not handle. Every record
is rendered at once where the recorded scale said thousands; or pagination,
virtualisation and a search control are imposed where the recorded scale said
a handful. The mechanism in the code was chosen without reference to the
number in the artifact.

## Why it fails
Scale decides the mechanism, and the wrong mechanism fails in the direction
nobody tested. Rendering thousands of rows unvirtualised is fine on the sample
data and unusable in production, and the failure arrives for the largest
customers first. In the other direction, paginating six items adds a control,
a round trip and a decision to a screen the user could have read whole.

## Fix
Implement the mechanism the recorded scale requires — virtualisation and
server-side filtering at volume, a single rendered set below it — and verify
against a data set of the size `intent.scale` names rather than the sample the
screen was built with. Where the real scale differs from the record, amend
`intent.scale` first, since the mechanism follows from it.

## Counter-example — when this is fine
A screen whose recorded scale is an upper bound reached by few, where the
implementation handles the common case directly and degrades deliberately at
the top of the range in a way the wireframe records.
