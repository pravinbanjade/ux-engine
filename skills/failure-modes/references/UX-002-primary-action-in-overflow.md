---
id: UX-002
title: The primary action lives inside an overflow menu
category: information-architecture
severity: high
detection: model
appliesTo: [toolbar, page-header, card]
---
## Signal
The action most users take on this screen — Create, Send, Approve, whatever
the page's reason for existing is — sits inside a kebab or "More" menu
alongside three or four low-frequency actions (Duplicate, Export, Archive),
instead of standing on its own as a visible button in the header or toolbar.

## Why it fails
An overflow menu is a promise that everything inside it is optional and
low-frequency; that's the only reason collapsing it costs nothing. Putting the
primary action there breaks the promise: every single user now pays a
discovery tax (click to open the menu, read every label, find the one they
need) for the action they take every visit, while genuinely rare actions read
as if they were peers of it.

## Fix
Promote the primary action to a standalone, high-emphasis button in the
toolbar or header — first in reading order or trailing edge per the page's
existing convention — and leave the overflow menu for actions used less than
roughly once a session. If two actions are both frequent, show both as
buttons; don't solve crowding by hiding the one that matters.

## Counter-example — when this is fine
A toolbar already at its width limit on small viewports where the primary
action is pinned as a persistent floating button or bottom bar and the
overflow menu holds only the secondary set — the primary action never moved,
the layout just relocated it outside this particular toolbar. Also fine when
the toolbar's version of the action is a redundant shortcut and the real
entry point is a large in-content button or empty-state call-to-action that
most users reach before they ever open the toolbar — the overflow item is a
convenience for returning users, not the only path to the action.
