---
id: UX-029
title: Navigation built as a button, or mutation built as a link
category: interaction
severity: medium
detection: model
appliesTo: [link, button, nav-item]
---
## Signal
An element that takes the user to another screen is a button whose handler
performs a programmatic redirect, with no destination in the markup — or an
element that changes state is an anchor with a placeholder target. Either way
the element's tag and its behaviour disagree.

## Why it fails
The platform's own affordances stop telling the truth. Middle-click,
open-in-new-tab, copy-link and the status bar preview all depend on a real
destination, so a button that navigates silently drops them; users who work in
tabs lose their habit and their place. In the other direction, an anchor that
mutates can be opened in a new tab by a user expecting to look at something,
and the state change fires anyway. Assistive technology announces the wrong
role in both cases.

## Fix
Match the element to the behaviour: anything that goes somewhere is an anchor
carrying the real destination, and anything that changes state is a button.
Where a navigation also needs script — analytics, an unsaved-changes guard —
keep the destination in the markup and let the handler run alongside it.

## Counter-example — when this is fine
A control that navigates only after work that can fail — a redirect issued
once a request returns, where the destination is not known until then. A
button is honest there, because there is no address to put in an anchor yet.
