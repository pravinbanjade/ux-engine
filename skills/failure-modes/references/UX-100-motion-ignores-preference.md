---
id: UX-100
title: Motion applied without checking the reduced-motion preference
category: accessibility
severity: medium
detection: hybrid
appliesTo: [page, modal, toast]
---
## Signal
Transitions, parallax, auto-playing video or looping animation are applied
unconditionally. No branch anywhere consults the user's stated preference for
reduced motion, so the system setting they turned on has no effect on this
interface.

## Why it fails
For people with vestibular disorders, large or unexpected motion causes
genuine physical symptoms — nausea, dizziness, migraine — that outlast the
session. They have already told their device they do not want it, which is why
the preference exists, and this interface has overridden that. The cost is
borne physically, and the usual response is to stop using the product.

## Fix
Guard motion behind the reduced-motion preference query and provide a still
equivalent that keeps the state change legible — a crossfade or an immediate
switch in place of a slide, no parallax, no autoplay. The point is that the
change remains visible; only the travel is removed.

## Counter-example — when this is fine
Motion that carries information nothing else conveys and is small and local —
a brief position change showing where an item moved to in a list. Removing it
would remove the meaning, though it should still be reduced to the smallest
movement that communicates.
