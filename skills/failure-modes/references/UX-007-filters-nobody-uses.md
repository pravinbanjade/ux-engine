---
id: UX-007
title: Filters offered for fields nobody narrows by
category: information-architecture
severity: medium
detection: model
appliesTo: [table, list, toolbar, search-results]
---
## Signal
The filter bar exposes controls for fields whose values are near-constant
across the data — a type that is the same for ninety per cent of rows, a
region when the deployment serves one — while the field the collection is most
often narrowed by, typically status, owner or date, has no control at all. The
tell is a filter whose dropdown would show one option, or one selected value
that changes nothing visible.

## Why it fails
Each useless control is read and dismissed by every user on every visit, and
their presence implies the set is complete — so a user who wants to narrow by
date concludes it cannot be done and scrolls instead. The screen has spent its
filter budget on the fields that were easiest to enumerate rather than the
ones that shorten the list.

## Fix
Derive the filter set from the fields this collection is actually narrowed by:
the ones named in saved views, the ones users sort by first, the ones support
requests ask for. Drop any control whose options are near-constant across the
present data, and give the remaining ones the profile's standard control
treatment so they read as one set.

## Counter-example — when this is fine
A filter whose options are sparse today but will not stay that way — a
workspace with one team that expects several, a catalog in its first month.
Shipping the control early keeps the layout stable and costs one row of
chrome, which is cheaper than re-teaching the screen later.
