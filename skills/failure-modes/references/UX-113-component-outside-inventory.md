---
id: UX-113
title: Component used that was not in the approved inventory
category: conformance
severity: low
detection: conformance
appliesTo: [generated-ui]
---
## Signal
The implementation imports or defines a user-facing component that does not
appear in the approved wireframe's inventory — not a primitive pulled in to
build one of the listed components, but a distinct piece of the interface the
reviewer never saw: an extra dialog, a second toolbar, a banner, a nested
panel that changes what the screen is.

## Why it fails
The inventory is the screen's scope written down. Something that is not in it
was never weighed against the intent, so nobody asked whether it earns the
space it takes, whether it competes with the primary action, or whether it
needs states of its own. Screens grow this way one unreviewed addition at a
time, and each one is individually defensible, which is exactly why the drift
is only visible against a list someone approved.

## Fix
Decide which it is. If the addition is needed, add it to the wireframe with a
revision note saying why it was not foreseen, so the inventory keeps matching
the screen and the next run's wireframer learns the omission. If it is not
needed — it was reached for out of habit, or it duplicates something already
in the inventory — remove it.

## Counter-example — when this is fine
A structural or presentational primitive that the listed components are made
out of: a layout wrapper, a visually hidden label, a portal container, an
error boundary. These are implementation detail rather than parts of the
interface a reviewer would recognise, and listing them in an inventory meant
to describe the screen would bury the things that actually matter.
