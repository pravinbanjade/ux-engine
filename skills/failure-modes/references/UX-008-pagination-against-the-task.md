---
id: UX-008
title: Pagination fights the task the screen exists for
category: information-architecture
severity: medium
detection: model
appliesTo: [table, list, pagination]
---
## Signal
The collection is cut into fixed-size pages while the job the screen supports
requires seeing the set whole — reconciling two figures, totalling a column,
scanning for the one outlier. There is no total count rendered, no view that
shows every record, and no export. The page control is the only way through,
and the number of pages is not shown either.

## Why it fails
A user totalling a column across six pages is doing arithmetic the screen
refused to do, and any error is invisible to them. Scanning for an outlier
across pages means holding a threshold in mind while the comparison set keeps
being replaced, so the outlier on page four is missed because page three reset
the sense of what normal looked like. Pagination has turned one glance into a
sequence of unverifiable ones.

## Fix
Match the mechanism to the task: keep the set on one scrollable surface where
it must be read whole, virtualising rows if volume demands it. Where volume
genuinely forbids that, render the total, render any aggregate the user would
otherwise compute by hand, and offer a route to the complete set through
export or a wider view.

## Counter-example — when this is fine
A collection users browse rather than reconcile — search results, an activity
feed, a catalog — where relevance ordering means the first page usually holds
the answer and no one needs a figure computed across the whole set.
