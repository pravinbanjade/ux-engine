---
id: UX-010
title: The detail view repeats the row it was opened from
category: information-architecture
severity: medium
detection: model
appliesTo: [detail-view, list]
---
## Signal
The detail route renders the same fields the list row already displayed, in
the same order, with the same formatting. It adds no related records, no
change history, no fields the row omitted for width, and no actions the row
did not already offer. The component reads as a single-record rendering of the
same projection the list used.

## Why it fails
The user clicked expecting more and paid a navigation round trip — a route
change, a fetch, a loss of scroll position and filter state — to receive what
they were already looking at. Worse, they now distrust the row: if the detail
view exists, they assume it holds something, so they read it carefully before
concluding there was nothing there, and they do that every time.

## Fix
Give the detail view the depth the row could not carry: related records,
change history, the long-form fields cut for column width, the actions that
need confirmation. Where no such depth exists, delete the route and let the
row expand in place, which keeps the list's scroll position and filters
intact.

## Counter-example — when this is fine
A detail route that exists to be linked to and shared — an addressable record
another system, an email or a notification points at — where the repetition is
the price of having a stable URL for one record rather than a failure of the
screen itself.
