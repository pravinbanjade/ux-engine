---
id: UX-117
title: A component recorded as reused was written fresh instead
category: conformance
severity: low
detection: conformance
appliesTo: [generated-ui]
---
## Signal
An entry in the wireframe's `components` inventory is marked as reused and
names the path it will be imported from, and the implementation does not
import it. A component doing the same job was written in place, with its own
markup and styling, while the recorded path goes untouched.

## Why it fails
The inventory is how the design states what it is building on, and reviewers
read it as an assurance that existing behaviour is inherited. A fresh
implementation inherits none of it — the states, the keyboard handling and the
accessibility work in the original are absent here, and future fixes to the
original will never reach this copy. The screen looks approved and is built on
a foundation nobody reviewed.

## Fix
Import the component the inventory names and delete the local duplicate,
passing the differences through its props. Where the existing component
genuinely could not serve, correct the inventory entry to say the component is
new and record why, so the next reader knows a second implementation exists on
purpose.

## Counter-example — when this is fine
A thin local wrapper around the named import that adds composition specific to
this screen. The recorded component is still the one doing the work; what is
new is the arrangement around it.
