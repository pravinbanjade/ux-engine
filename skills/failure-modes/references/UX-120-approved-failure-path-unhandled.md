---
id: UX-120
title: The recorded failure has no branch that detects it
category: conformance
severity: high
detection: conformance
appliesTo: [generated-ui]
---
## Signal
`intent.failure` records the thing that goes wrong most often on this screen —
the upload that is rejected, the sync that falls behind, the permission that
expires — and the implementation contains no branch that detects that
condition and nothing that tells the user it happened. The generic error path
covers it, or nothing does.

## Why it fails
The intent gate asked what fails here precisely so the screen could be built
to handle it well, and a reviewer approved the answer. The one case everybody
agreed was most likely is now the case handled worst — reported, if at all, as
an unspecified error with no remedy named. The user meets the product's most
common failure at its least helpful, and the artifact records that this was
thought about.

## Fix
Implement detection for the recorded condition and a message that names what
happened and what to do about it, distinct from the generic error branch.
Where the failure turned out not to be detectable from the client, record that
in the wireframe and implement the nearest signal that is, rather than leaving
the case to the catch-all.

## Counter-example — when this is fine
A failure handled entirely upstream of this screen — intercepted by the route,
the data layer or a shared boundary that renders its own specific message. The
branch exists; it is not in this component.
