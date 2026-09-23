---
id: UX-118
title: The implementation's density contradicts the recorded audience
category: conformance
severity: medium
detection: conformance
appliesTo: [generated-ui]
---
## Signal
The density of the implemented screen disagrees with `intent.who` and
`intent.cadence`. An expert audience recorded as using this many times a day
is given oversized rows, generous padding and one action per screen; or an
occasional audience is given a dense grid, abbreviated headers and unlabelled
icon controls.

## Why it fails
Density is a trade between how much is visible and how much explanation each
item carries, and the right trade depends entirely on who is reading and how
often. A daily user paying for generous spacing scrolls constantly for
information that would have fitted on one screen. An occasional user facing an
expert-density grid cannot decode it, and abandons or asks for help. Both
audiences were described in the artifact before either screen was built.

## Fix
Set row height, padding, label verbosity and the number of visible actions
from the recorded audience and cadence, drawing the values from the profile's
spacing scale rather than choosing them per screen. Where the audience turned
out to be mixed, record that in `intent.who` and provide a density the user
controls.

## Counter-example — when this is fine
A screen serving one audience at two moments — dense in routine use, expanded
during a task that needs detail — where the implementation offers both and the
default matches the recorded cadence.
