---
id: UX-011
title: Named relations rendered as text rather than links
category: information-architecture
severity: low
detection: model
appliesTo: [detail-view, list, link]
---
## Signal
A record names a related entity — its owner, its parent account, the order it
belongs to — as a plain text node, though the relation carries an identifier
the interface could route on. Reaching that entity means leaving the screen,
opening the relevant list and searching for the name by hand.

## Why it fails
The data is a graph and the interface has flattened it into pages. Every
traversal the user makes costs a manual search, which is slow, loses the
current screen's state, and fails outright when two entities share a name.
Users learn not to follow relations at all, which hides exactly the context
the relation was recorded to provide.

## Fix
Render each named relation as a link to that record, using the profile's link
treatment so it is recognisable as navigable, and route on the identifier the
record already carries rather than on the display name. Where the user lacks
permission to open the target, render the name unlinked and say why.

## Counter-example — when this is fine
A relation to something with no screen of its own — a denormalised label, an
enum rendered from a lookup table, a name captured as free text at entry time.
Linking there promises a destination that does not exist.
