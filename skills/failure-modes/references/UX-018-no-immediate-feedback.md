---
id: UX-018
title: The control does not acknowledge the press
category: interaction
severity: medium
detection: model
appliesTo: [button, form-submit, link]
---
## Signal
Activating the control starts asynchronous work, and nothing in the rendered
output changes until that work returns. There is no pressed treatment, no busy
state, no disabled interval — the component's only visual response is whatever
the platform draws by default, which on a custom-styled control is often
nothing at all.

## Why it fails
The user cannot tell whether the press registered. On a slow connection the
gap between the click and the result runs to seconds, and the reasonable
inference is that the click missed — so they press again, which either
duplicates the work or cancels and restarts it. The interface has made its own
responsiveness invisible, and the user pays for that in repeated actions and
lost confidence.

## Fix
Change the control's appearance the instant it is activated, using the
profile's pressed and busy treatments, and hold the busy state until the work
resolves either way. The acknowledgement must not depend on the response: it
is the press being confirmed, not the outcome.

## Counter-example — when this is fine
A control whose effect is immediate and visible in the same frame — a filter
chip that reorders the list below it, a tab that swaps a panel. The result is
the acknowledgement, and an extra pressed state would flash without informing.
