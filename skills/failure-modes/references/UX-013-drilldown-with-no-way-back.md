---
id: UX-013
title: A drill-down screen renders no return path
category: information-architecture
severity: medium
detection: model
appliesTo: [detail-view, breadcrumb, page-header]
---
## Signal
A screen reached by selecting an item from a collection renders no back
control and no ancestor trail. The only way out is the browser's own back
button — which stops pointing at the collection as soon as the user navigates
within the screen, switches a tab, or opens a nested record.

## Why it fails
The user's return journey depends on a control the screen does not own and
cannot keep accurate. Once in-screen navigation has consumed it, going back
means guessing: press back repeatedly and watch the tabs unwind, or start
again from the top navigation and re-apply the filters that produced the
collection. On a touch device with no browser chrome, there may be no way back
at all.

## Fix
Render an explicit return control in the page header that names its
destination — the collection, by the name the user filtered it into — and
route to it directly rather than popping history. Where the screen sits more
than one level deep, render the full trail so each ancestor is reachable in
one action.

## Counter-example — when this is fine
A screen with no single sensible parent, reached from several places — a
record opened from search, from a notification, and from a dashboard tile.
Naming one of those as the way back would be wrong for the other two; an
explicit close that returns to the previous context serves better than a trail.
