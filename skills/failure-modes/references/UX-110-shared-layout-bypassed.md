---
id: UX-110
title: A screen composes its own page structure instead of the shared one
category: system-consistency
severity: low
detection: model
appliesTo: [page]
---
## Signal
The screen builds its own page shell — its own maximum width, its own gutters,
its own header placement — rather than rendering inside the layout container
every other screen uses. The shared container exists in the repository and
this route does not import it.

## Why it fails
The screen is now outside the system: when the shared layout's width, gutters
or header change, every screen moves except this one, and the divergence grows
with each change nobody remembers to mirror. Users feel it as a screen that
sits slightly wrong — content starting at a different edge, a header a few
pixels off — without being able to name what differs.

## Fix
Render the screen inside the shared layout container and express whatever is
genuinely different through the props that container already accepts, such as
a wider content variant or a suppressed header. Where it accepts nothing that
fits, add the option to the container so the next screen needing it inherits
the decision.

## Counter-example — when this is fine
A surface deliberately outside the application shell — a sign-in screen, a
print view, an embedded surface rendered inside another product. The shared
layout would impose chrome that does not belong there.
